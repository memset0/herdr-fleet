import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  classifyCodexLoginStatus,
  CODEX_STATUS_TIMEOUT_MS,
  createCodexDetector,
  type CodexStatusRun,
  type CodexStatusRunner,
  runCodexLoginStatus,
} from "./codex-detect.ts";

// The sign-in check behind Settings' Codex row (ADR 0097), driven with an injected runner: no test here
// starts a real `codex`, and none reads `~/.codex`.

const run = (over: Partial<CodexStatusRun>): CodexStatusRun => ({ code: 0, output: "", timedOut: false, spawnFailed: false, ...over });

describe("classifyCodexLoginStatus", () => {
  test("only codex's own ChatGPT line, with exit 0, is ready", () => {
    expect(classifyCodexLoginStatus(run({ output: "Logged in using ChatGPT\n" }))).toBe("ready");
    // The same line with a failing exit is not trusted.
    expect(classifyCodexLoginStatus(run({ code: 1, output: "Logged in using ChatGPT\n" }))).toBe("unknown");
    // A line that merely contains the words is not codex's line.
    expect(classifyCodexLoginStatus(run({ output: "Not: Logged in using ChatGPT\n" }))).toBe("unknown");
  });

  test("not signed in, another login, and the rest", () => {
    expect(classifyCodexLoginStatus(run({ code: 1, output: "Not logged in\n" }))).toBe("signed-out");
    expect(classifyCodexLoginStatus(run({ output: "Logged in using an API key - sk-proj-***abcd\n" }))).toBe("other-login");
    expect(classifyCodexLoginStatus(run({ output: "Logged in using personal access token\n" }))).toBe("other-login");
    expect(classifyCodexLoginStatus(run({ code: 1, output: "Error checking login status: boom\n" }))).toBe("unknown");
    expect(classifyCodexLoginStatus(run({ code: null, timedOut: true, output: "Logged in using ChatGPT\n" }))).toBe("unknown");
    expect(classifyCodexLoginStatus(run({ code: null, spawnFailed: true }))).toBe("missing");
  });
});

describe("createCodexDetector", () => {
  /** A runner that answers one fixed run, and the calls it was asked. */
  interface Counting {
    runner: CodexStatusRunner;
    calls: { bin: string; timeoutMs: number }[];
  }

  function counting(output: string, code = 0): Counting {
    const calls: { bin: string; timeoutMs: number }[] = [];
    return {
      calls,
      runner: async (bin, timeoutMs) => {
        calls.push({ bin, timeoutMs });
        return run({ code, output });
      },
    };
  }

  test("no binary is missing, and nothing runs", async () => {
    const { runner, calls } = counting("Logged in using ChatGPT\n");
    const detector = createCodexDetector({ locate: () => null, run: runner });
    expect(await detector.check()).toEqual({ state: "missing" });
    expect(calls).toEqual([]);
  });

  test("asks `codex` once per TTL, with the short deadline, and again when asked for a fresh answer", async () => {
    let clock = 1_000;
    const { runner, calls } = counting("Logged in using ChatGPT\n");
    const detector = createCodexDetector({ locate: () => "/usr/bin/codex", run: runner, now: () => clock, ttlMs: 30_000 });
    expect(await detector.check()).toEqual({ state: "ready", codexBin: "/usr/bin/codex" });
    clock += 29_000;
    await detector.check();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ bin: "/usr/bin/codex", timeoutMs: CODEX_STATUS_TIMEOUT_MS });
    await detector.check(true);
    expect(calls).toHaveLength(2);
    clock += 31_000;
    await detector.check();
    expect(calls).toHaveLength(3);
  });

  test("two askers at once share one child", async () => {
    let release: (value: CodexStatusRun) => void = () => undefined;
    let runs = 0;
    const detector = createCodexDetector({
      locate: () => "/usr/bin/codex",
      run: () => {
        runs += 1;
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    });
    const first = detector.check();
    const second = detector.check(true);
    release(run({ code: 1, output: "Not logged in\n" }));
    expect(await first).toEqual({ state: "signed-out", codexBin: "/usr/bin/codex" });
    expect(await second).toEqual({ state: "signed-out", codexBin: "/usr/bin/codex" });
    expect(runs).toBe(1);
  });

  test("a runner that throws is unknown, never ready", async () => {
    const detector = createCodexDetector({
      locate: () => "/usr/bin/codex",
      run: async () => {
        throw new Error("boom");
      },
    });
    expect(await detector.check()).toEqual({ state: "unknown", codexBin: "/usr/bin/codex" });
  });

  test("a different binary is a different question", async () => {
    let bin = "/usr/bin/codex";
    const { runner, calls } = counting("Logged in using ChatGPT\n");
    const detector = createCodexDetector({ locate: () => bin, run: runner });
    await detector.check();
    bin = "/opt/codex/bin/codex";
    expect(await detector.check()).toEqual({ state: "ready", codexBin: "/opt/codex/bin/codex" });
    expect(calls.map((c) => c.bin)).toEqual(["/usr/bin/codex", "/opt/codex/bin/codex"]);
  });
});

describe("runCodexLoginStatus, the real child", () => {
  // A stand-in `codex`: a shell script, so the argv, the stream capture and the deadline are real.
  /** A stand-in binary on disk, and how to remove it. */
  interface FakeBinary {
    path: string;
    done: () => void;
  }

  function script(body: string): FakeBinary {
    const dir = mkdtempSync(join(tmpdir(), "collie-codex-status-"));
    const path = join(dir, "codex");
    writeFileSync(path, `#!/bin/sh\n${body}\n`);
    chmodSync(path, 0o755);
    return { path, done: () => rmSync(dir, { recursive: true, force: true }) };
  }

  test("runs `<bin> login status` with no shell and reads stderr too", async () => {
    if (process.platform === "win32") return;
    const fake = script('[ "$#" = 2 ] && [ "$1" = login ] && [ "$2" = status ] && { echo "Logged in using ChatGPT" >&2; exit 0; }\nexit 3');
    try {
      const result = await runCodexLoginStatus(fake.path, 5_000);
      expect(result).toEqual({ code: 0, output: "Logged in using ChatGPT\n", timedOut: false, spawnFailed: false });
      expect(classifyCodexLoginStatus(result)).toBe("ready");
    } finally {
      fake.done();
    }
  });

  test("a child that hangs is killed at the deadline and reads as unknown", async () => {
    if (process.platform === "win32") return;
    const fake = script("exec sleep 30");
    try {
      const started = Date.now();
      const result = await runCodexLoginStatus(fake.path, 200);
      expect(Date.now() - started).toBeLessThan(5_000);
      expect(result.timedOut).toBe(true);
      expect(classifyCodexLoginStatus(result)).toBe("unknown");
    } finally {
      fake.done();
    }
  });

  test("a binary that is not there is missing", async () => {
    const result = await runCodexLoginStatus(join(tmpdir(), "collie-no-such-codex", "codex"), 1_000);
    expect(classifyCodexLoginStatus(result)).toBe("missing");
  });
});
