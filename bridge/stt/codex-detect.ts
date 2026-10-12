import { spawn as spawnChild } from "node:child_process";

// ── IS `codex` HERE, AND IS IT SIGNED IN WITH CHATGPT? ───────────────────────────────────────
//
// Settings → Voice offers Codex as the host's speech provider only when the answer is yes (ADR 0097).
// The question is asked of the binary itself, through its own read-only verb:
//
//     codex login status
//
// which prints one line and exits: `Logged in using ChatGPT` (exit 0), `Logged in using an API key -
// sk-…` and other `Logged in using …` lines for logins this provider cannot use, or `Not logged in`
// (exit 1). Checked against codex-cli 0.162.1 on 2026-10-11. Collie does NOT read `~/.codex/auth.json`
// to find out (ADR 0029 rejected that for the token, and the reason holds for a peek), and it does not
// start `codex app-server` for a status line, which costs a long-running child and a handshake.
//
// THE OUTPUT IS CLASSIFIED AND DROPPED. It is never logged, never returned and never put on the
// wire: an API-key login prints a masked key, and a masked key is still not ours to repeat. Only the
// verdict below leaves this module.
//
// THE COST: one short-lived child, argv only and never a shell, killed after
// {@link CODEX_STATUS_TIMEOUT_MS}, its output capped at {@link CODEX_STATUS_OUTPUT_CAP} bytes, at most
// once per {@link CODEX_STATUS_TTL_MS} however many devices open the page, and one at a time. A write
// that is about to depend on the answer asks for a fresh one.

/** What the host's `codex` can do for the speech provider. Only `ready` may be switched to. */
export type CodexSignInState = "ready" | "missing" | "signed-out" | "other-login" | "unknown";

export interface CodexSignIn {
  state: CodexSignInState;
  /** The binary that was asked, as an absolute path. Absent when none was found. */
  codexBin?: string;
}

/** One run of `codex login status`, reduced to what the verdict needs. */
export interface CodexStatusRun {
  /** The exit code, or null when the child was killed or never started. */
  code: number | null;
  /** stdout and stderr together, at most {@link CODEX_STATUS_OUTPUT_CAP} bytes of them. */
  output: string;
  /** The deadline expired and the child was killed. */
  timedOut: boolean;
  /** The binary could not be started at all (gone since it was found, not executable). */
  spawnFailed: boolean;
}

/** Runs `<codexBin> login status`. Injected by the tests, so none of them needs a real `codex`. */
export type CodexStatusRunner = (codexBin: string, timeoutMs: number) => Promise<CodexStatusRun>;

/** How long `codex login status` may take. It reads one file and prints one line. */
export const CODEX_STATUS_TIMEOUT_MS = 5_000;
/** How long an answer is reused. Long enough that a page full of devices costs one child. */
export const CODEX_STATUS_TTL_MS = 30_000;
/** The most output read from the child. The line that matters is under 40 bytes. */
export const CODEX_STATUS_OUTPUT_CAP = 4096;

/**
 * The verdict for one run. Only the line codex prints for a ChatGPT login is `ready`: the transcription
 * endpoint belongs to the ChatGPT product (bridge/stt/codex-auth.ts refuses an API-key login by name for
 * the same reason). Anything the classifier does not recognise is `unknown`, never `ready`.
 */
export function classifyCodexLoginStatus(run: CodexStatusRun): CodexSignInState {
  if (run.spawnFailed) return "missing";
  if (run.timedOut) return "unknown";
  if (/^Logged in using ChatGPT\s*$/m.test(run.output)) return run.code === 0 ? "ready" : "unknown";
  if (/^Not logged in\b/m.test(run.output)) return "signed-out";
  if (/^Logged in using\b/m.test(run.output)) return "other-login";
  return "unknown";
}

export interface CodexDetector {
  /**
   * The verdict, from the cache while it is younger than the TTL and was asked of the same binary.
   * `fresh` skips the cache: a write that is about to depend on the answer asks again.
   */
  check(fresh?: boolean): Promise<CodexSignIn>;
}

export interface CodexDetectorOptions {
  /** The binary to ask, as an absolute path, or null when there is none. Asked on every check. */
  locate(): string | null;
  run?: CodexStatusRunner;
  now?(): number;
  ttlMs?: number;
}

export function createCodexDetector(options: CodexDetectorOptions): CodexDetector {
  const run = options.run ?? runCodexLoginStatus;
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? CODEX_STATUS_TTL_MS;
  let cached: { at: number; answer: CodexSignIn } | null = null;
  let inflight: { codexBin: string; answer: Promise<CodexSignIn> } | null = null;

  return {
    async check(fresh = false) {
      const codexBin = options.locate();
      if (codexBin === null) return { state: "missing" };
      if (!fresh && cached !== null && cached.answer.codexBin === codexBin && now() - cached.at < ttlMs) return cached.answer;
      // One child at a time: a second asker joins the run already under way for the same binary.
      if (inflight !== null && inflight.codexBin === codexBin) return inflight.answer;
      const answer = run(codexBin, CODEX_STATUS_TIMEOUT_MS)
        .then((result): CodexSignIn => ({ state: classifyCodexLoginStatus(result), codexBin }))
        .catch((): CodexSignIn => ({ state: "unknown", codexBin }))
        .then((verdict) => {
          cached = { at: now(), answer: verdict };
          return verdict;
        })
        .finally(() => {
          if (inflight?.answer === answer) inflight = null;
        });
      inflight = { codexBin, answer };
      return answer;
    },
  };
}

/**
 * The real run. No shell: the path came from a PATH search or from `stt.json`, and a shell would turn
 * a stray character in it into a command. stdin is closed, so a codex that ever asked a question would
 * read end-of-file rather than wait. The environment is the bridge's own, the one `codex app-server`
 * gets in bridge/stt/codex-auth.ts, so both find the same sign-in.
 */
export function runCodexLoginStatus(codexBin: string, timeoutMs: number): Promise<CodexStatusRun> {
  let child: ReturnType<typeof spawnChild>;
  try {
    child = spawnChild(codexBin, ["login", "status"], { stdio: ["ignore", "pipe", "pipe"], shell: false });
  } catch {
    return Promise.resolve({ code: null, output: "", timedOut: false, spawnFailed: true });
  }
  return new Promise((resolve) => {
    let output = "";
    let timedOut = false;
    // The one place this promise settles. The child's error and its close may both arrive; only the
    // first counts, because `settle` is dropped after it.
    let settle: ((result: CodexStatusRun) => void) | null = resolve;
    const finish = (result: CodexStatusRun): void => {
      clearTimeout(timer);
      settle?.(result);
      settle = null;
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    const take = (chunk: Buffer): void => {
      if (output.length < CODEX_STATUS_OUTPUT_CAP) output = (output + chunk.toString("utf8")).slice(0, CODEX_STATUS_OUTPUT_CAP);
    };
    child.stdout?.on("data", take);
    child.stderr?.on("data", take);
    child.on("error", () => finish({ code: null, output: "", timedOut, spawnFailed: !timedOut }));
    child.on("close", (code) => finish({ code: timedOut ? null : code, output, timedOut, spawnFailed: false }));
  });
}
