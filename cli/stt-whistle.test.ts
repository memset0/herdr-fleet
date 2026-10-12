import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { STT_ENV_KEYS, STT_FILENAME } from "../bridge/stt/config.ts";
import { resetWhistleModelState, whistlePartName, whistlePaths, type WhistleFetch } from "../bridge/stt/whistle-model.ts";
import { capture, context, fakeExec, fakeFiles, type FakeFiles } from "./fakes.ts";
import { EXIT } from "./io.ts";
import { cmdStt, cmdSttOff, cmdSttSetup, cmdSttStatus, type SttDeps } from "./stt.ts";
import { cmdSttWhistle } from "./stt-whistle.ts";

// `collie stt whistle` against a REAL temp state dir (the model store works on real files) and a fake
// fetch (no network, ever). `stt.json` goes through the fake `Files`, as in cli/stt.test.ts, and is
// keyed by the temp dir's path so both halves agree on where the state dir is.

const MODEL: Uint8Array<ArrayBuffer> = new TextEncoder().encode("a tiny stand-in for whistle.cact, 40+ bytes long");
const SHA = createHash("sha256").update(MODEL).digest("hex");
const PIN = { url: "https://models.invalid/whistle.cact", revision: "ca5287601bef25af", sha256: SHA, bytes: MODEL.byteLength };

let stateDir: string;
let calls: number;

beforeEach(() => {
  resetWhistleModelState();
  stateDir = mkdtempSync(join(tmpdir(), "collie-stt-whistle-"));
  calls = 0;
});
afterEach(() => {
  resetWhistleModelState();
  rmSync(stateDir, { recursive: true, force: true });
});

const sttJson = (): string => join(stateDir, STT_FILENAME);

/** Another process's download on disk: a lock naming its part file, and the part. Returns the part's path. */
function otherDownload(content: string, ageMs = 0): string {
  const paths = whistlePaths(stateDir);
  mkdirSync(paths.dir, { recursive: true });
  const name = whistlePartName(999_999, 1);
  const part = join(paths.dir, name);
  writeFileSync(part, content);
  writeFileSync(paths.lock, JSON.stringify({ pid: 999_999, startedAt: new Date().toISOString(), part: name }));
  if (ageMs > 0) {
    const old = new Date(Date.now() - ageMs);
    utimesSync(paths.lock, old, old);
    utimesSync(part, old, old);
  }
  return part;
}

/** Part files, the lock and temporaries left in the model's folder. */
const leftovers = (): string[] => {
  const dir = whistlePaths(stateDir).dir;
  return existsSync(dir) ? readdirSync(dir).filter((name) => name === "whistle.lock" || name.endsWith(".part") || name.endsWith(".tmp")) : [];
};

type Deps = SttDeps & { io: ReturnType<typeof capture>; files: FakeFiles; progressed: string[] };

function fetchOf(body: Uint8Array<ArrayBuffer> = MODEL, wait: Promise<void> = Promise.resolve()): WhistleFetch {
  return async () => {
    calls += 1;
    await wait;
    return new Response(body, { headers: { "content-length": String(body.byteLength) } });
  };
}

function deps(
  over: {
    seed?: Record<string, string>;
    env?: Record<string, string | undefined>;
    answers?: string[];
    fetch?: WhistleFetch;
    tty?: boolean;
  } = {},
): Deps {
  const queued = [...(over.answers ?? [])];
  const progressed: string[] = [];
  const built: Deps = {
    ctx: context(over.env ?? {}, { stateDir }),
    io: capture(),
    files: fakeFiles(over.seed ?? {}),
    exec: fakeExec(),
    interactive: over.tty ?? queued.length > 0,
    prompt: () => queued.shift() ?? null,
    whistle: { fetch: over.fetch ?? fetchOf(), lookup: async () => ["203.0.113.7"], pin: PIN, accepted: [SHA] },
    progressed,
  };
  if (over.tty === true) built.progress = (text) => progressed.push(text);
  return built;
}

const said = (d: Deps): string => [...d.io.stdout, ...d.io.stderr].join("\n");
/** The provider name in the `stt.json` just written, or undefined when none was. */
const writtenDocument = (d: Deps): { provider?: string } | undefined => {
  const text = d.files.entries.get(sttJson())?.text;
  // SAFETY: this is the file `writeSttSettingsFile` serialised a call ago, read back by its own test.
  return text === undefined ? undefined : (JSON.parse(text) as { provider?: string });
};

describe("collie stt whistle: the model", () => {
  test("fetches the pinned model, says so, and leaves the host engine alone", async () => {
    const d = deps();
    expect(await cmdSttWhistle(d, [])).toBe(EXIT.OK);
    expect(readFileSync(whistlePaths(stateDir).model)).toEqual(Buffer.from(MODEL));
    expect(calls).toBe(1);
    expect(said(d)).toContain("the Whistle model is on this host");
    expect(said(d)).toContain(`sha256 ${SHA.slice(0, 8)}`);
    expect(said(d)).toContain("collie stt whistle --host");
    expect(d.files.entries.has(sttJson())).toBe(false);
  });

  test("a second run is already present and fetches nothing", async () => {
    const d = deps();
    await cmdSttWhistle(d, []);
    const again = deps();
    expect(await cmdSttWhistle(again, [])).toBe(EXIT.OK);
    expect(calls).toBe(1);
    expect(said(again)).toContain("already present");
  });

  test("on a terminal a progress line is drawn and closed; piped, none is", async () => {
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tty = deps({ tty: true, fetch: fetchOf(MODEL, wait) });
    const running = cmdSttWhistle(tty, []);
    setTimeout(release, 30);
    expect(await running).toBe(EXIT.OK);
    expect(tty.progressed.length).toBeGreaterThan(0);
    expect(tty.progressed[0]).toMatch(/^\r  \d+\.\d MB of \d+\.\d MB$/);
    expect(tty.progressed.at(-1)).toBe("\n");

    resetWhistleModelState();
    rmSync(whistlePaths(stateDir).dir, { recursive: true, force: true });
    const piped = deps();
    await cmdSttWhistle(piped, []);
    expect(piped.progressed).toEqual([]);
  });

  test("a download that fails keeps nothing and exits non-zero with the reason", async () => {
    const wrong = new TextEncoder().encode("not the pinned bytes, but of a plausible length");
    const d = deps({ fetch: fetchOf(wrong) });
    expect(await cmdSttWhistle(d, [])).toBe(EXIT.FAIL);
    expect(said(d)).toContain("did not match the pinned model");
    expect(said(d)).toContain(SHA);
    expect(existsSync(whistlePaths(stateDir).model)).toBe(false);
    expect(leftovers()).toEqual([]);
  });

  test("a download another process has running is reported, nothing is fetched, nothing is touched", async () => {
    const part = otherDownload("partial");
    const d = deps();
    expect(await cmdSttWhistle(d, [])).toBe(EXIT.FAIL);
    expect(said(d)).toContain("a download is already running");
    expect(calls).toBe(0);
    expect(readFileSync(part, "utf8")).toBe("partial");
  });

  test("a stale lock is a crash's and is replaced", async () => {
    otherDownload("partial", 11 * 60 * 1000);
    const d = deps();
    expect(await cmdSttWhistle(d, [])).toBe(EXIT.OK);
    expect(calls).toBe(1);
  });
});

describe("collie stt whistle --from", () => {
  const source = (): string => join(stateDir, "..", `collie-stt-from-${process.pid}.cact`);
  afterEach(() => rmSync(source(), { force: true }));

  test("takes a local file through the same hash check, with no fetch", async () => {
    writeFileSync(source(), MODEL);
    const d = deps();
    expect(await cmdSttWhistle(d, ["--from", source()])).toBe(EXIT.OK);
    expect(calls).toBe(0);
    expect(readFileSync(whistlePaths(stateDir).model)).toEqual(Buffer.from(MODEL));
    expect(leftovers()).toEqual([]);
  });

  test("a file of other bytes is refused with both hashes, and nothing is kept", async () => {
    const other = new TextEncoder().encode("another file entirely, of a plausible length");
    writeFileSync(source(), other);
    const d = deps();
    expect(await cmdSttWhistle(d, [`--from=${source()}`])).toBe(EXIT.FAIL);
    expect(said(d)).toContain(createHash("sha256").update(other).digest("hex"));
    expect(said(d)).toContain(SHA);
    expect(existsSync(whistlePaths(stateDir).model)).toBe(false);
    expect(leftovers()).toEqual([]);
  });

  test("a symlink, a folder and a missing file are refused before anything is touched", async () => {
    const d = deps();
    expect(await cmdSttWhistle(d, ["--from", join(stateDir, "nope")])).toBe(EXIT.FAIL);
    expect(await cmdSttWhistle(d, ["--from", stateDir])).toBe(EXIT.FAIL);
    if (process.platform !== "win32") {
      writeFileSync(source(), MODEL);
      const link = join(stateDir, "link.cact");
      symlinkSync(source(), link);
      expect(await cmdSttWhistle(d, ["--from", link])).toBe(EXIT.FAIL);
      expect(said(d)).toContain("symlink");
    }
    expect(existsSync(whistlePaths(stateDir).dir)).toBe(false);
  });

  test("with the model already there it says so and copies nothing", async () => {
    await cmdSttWhistle(deps(), []);
    writeFileSync(source(), MODEL);
    const d = deps();
    expect(await cmdSttWhistle(d, ["--from", source()])).toBe(EXIT.OK);
    expect(said(d)).toContain("already present");
  });
});

describe("collie stt whistle --host", () => {
  test("with nothing configured it fetches the model and writes the provider", async () => {
    const d = deps();
    expect(await cmdSttWhistle(d, ["--host"])).toBe(EXIT.OK);
    expect(writtenDocument(d)).toEqual({ provider: "whistle" });
    expect(said(d)).toContain("now Whistle");
    expect(said(d)).toContain("no restart");
    expect(d.files.entries.get(sttJson())?.mode).toBe(0o600);
  });

  test("when the provider is already Whistle it writes nothing more", async () => {
    const d = deps({ seed: { [sttJson()]: JSON.stringify({ provider: "whistle" }) } });
    expect(await cmdSttWhistle(d, ["--host"])).toBe(EXIT.OK);
    expect(said(d)).toContain("already Whistle");
  });

  test("a file holding only a change stamp names no provider: no question, Whistle is written", async () => {
    const stamp = JSON.stringify({ changedBy: "Pixel 8", changedAt: "2026-10-11T08:00:00.000Z" });
    // "n" is queued so that a question would stop the run; the run must not ask.
    const d = deps({ seed: { [sttJson()]: stamp }, answers: ["n"] });
    expect(await cmdSttWhistle(d, ["--host"])).toBe(EXIT.OK);
    expect(said(d)).not.toContain("Replace it with Whistle");
    expect(said(d)).not.toContain("already has");
    expect(writtenDocument(d)).toEqual({ provider: "whistle" });

    const quiet = deps({ seed: { [sttJson()]: stamp } });
    expect(await cmdSttWhistle(quiet, ["--host"])).toBe(EXIT.OK);
    expect(writtenDocument(quiet)).toEqual({ provider: "whistle" });
  });

  const OTHER = () => ({ [sttJson()]: JSON.stringify({ provider: "local-cli", command: "/opt/engine" }) });

  test("another provider and no terminal and no --yes: refused, nothing written, nothing fetched", async () => {
    const d = deps({ seed: OTHER() });
    expect(await cmdSttWhistle(d, ["--host"])).toBe(EXIT.FAIL);
    expect(said(d)).toContain("`local-cli` provider");
    expect(said(d)).toContain("--yes");
    expect(calls).toBe(0);
    expect(JSON.parse(d.files.entries.get(sttJson())!.text).provider).toBe("local-cli");
    expect(existsSync(whistlePaths(stateDir).dir)).toBe(false);
  });

  test("on a terminal it asks, and no (or nothing) stops it", async () => {
    for (const answer of ["n", "", "maybe"]) {
      const d = deps({ seed: OTHER(), answers: [answer] });
      expect(await cmdSttWhistle(d, ["--host"])).toBe(EXIT.FAIL);
      expect(JSON.parse(d.files.entries.get(sttJson())!.text).provider).toBe("local-cli");
      expect(calls).toBe(0);
    }
  });

  test("on a terminal, y replaces it", async () => {
    const d = deps({ seed: OTHER(), answers: ["Y"] });
    expect(await cmdSttWhistle(d, ["--host"])).toBe(EXIT.OK);
    expect(writtenDocument(d)).toEqual({ provider: "whistle" });
  });

  test("--yes replaces it without a terminal", async () => {
    const d = deps({ seed: OTHER() });
    expect(await cmdSttWhistle(d, ["--host", "--yes"])).toBe(EXIT.OK);
    expect(writtenDocument(d)).toEqual({ provider: "whistle" });
    expect(said(d)).toContain("--yes was passed");
  });

  test("an stt.json that cannot be read is another provider's, never nothing", async () => {
    const d = deps({ seed: { [sttJson()]: "{ not json" } });
    expect(await cmdSttWhistle(d, ["--host"])).toBe(EXIT.FAIL);
    expect(d.files.entries.get(sttJson())?.text).toBe("{ not json");
  });

  test("a provider the environment names cannot be replaced from the file, even with --yes", async () => {
    const d = deps({ env: { [STT_ENV_KEYS.provider]: "openai-compatible" } });
    expect(await cmdSttWhistle(d, ["--host", "--yes"])).toBe(EXIT.FAIL);
    expect(said(d)).toContain("environment");
    expect(d.files.entries.has(sttJson())).toBe(false);
    expect(calls).toBe(0);
  });

  test("if the fetch fails, the provider is not written", async () => {
    const d = deps({ fetch: fetchOf(new TextEncoder().encode("wrong bytes of some length at all, yes")) });
    expect(await cmdSttWhistle(d, ["--host"])).toBe(EXIT.FAIL);
    expect(d.files.entries.has(sttJson())).toBe(false);
  });

  test("`stt setup --provider whistle` still refuses and points here", async () => {
    const d = deps();
    expect(await cmdSttSetup(d, ["--provider", "whistle"])).toBe(EXIT.FAIL);
    expect(said(d)).toContain("collie stt whistle --host");
    expect(d.files.entries.has(sttJson())).toBe(false);
  });
});

describe("collie stt whistle --remove", () => {
  test("deletes the model and, when the provider is Whistle, the provider, and says both", async () => {
    await cmdSttWhistle(deps(), []);
    const d = deps({ seed: { [sttJson()]: JSON.stringify({ provider: "whistle" }) } });
    expect(await cmdSttWhistle(d, ["--remove"])).toBe(EXIT.OK);
    expect(existsSync(whistlePaths(stateDir).model)).toBe(false);
    expect(d.files.entries.has(sttJson())).toBe(false);
    expect(said(d)).toContain("removed the Whistle model");
    expect(said(d)).toContain("removed the host provider `whistle`");
  });

  test("never touches another provider", async () => {
    await cmdSttWhistle(deps(), []);
    const theirs = JSON.stringify({ provider: "codex", codexBin: "/usr/bin/codex", wireIdentity: "honest" });
    const d = deps({ seed: { [sttJson()]: theirs } });
    expect(await cmdSttWhistle(d, ["--remove"])).toBe(EXIT.OK);
    expect(existsSync(whistlePaths(stateDir).model)).toBe(false);
    expect(d.files.entries.get(sttJson())?.text).toBe(theirs);
    expect(said(d)).not.toContain("host provider");
  });

  test("with nothing there it says so and succeeds", async () => {
    const d = deps();
    expect(await cmdSttWhistle(d, ["--remove"])).toBe(EXIT.OK);
    expect(said(d)).toContain("nothing to remove");
  });

  test("while another process downloads it removes nothing", async () => {
    const part = otherDownload("partial");
    const d = deps();
    expect(await cmdSttWhistle(d, ["--remove"])).toBe(EXIT.FAIL);
    expect(existsSync(part)).toBe(true);
    expect(existsSync(whistlePaths(stateDir).lock)).toBe(true);
  });
});

describe("collie stt whistle: arguments", () => {
  test("a bad argument is a usage error with the usage block, and does nothing", async () => {
    for (const args of [["--bogus"], ["extra"], ["--from"], ["--remove", "--host"], ["--remove", "--from", "x"]]) {
      const d = deps();
      expect(await cmdSttWhistle(d, args)).toBe(EXIT.USAGE);
      expect(d.io.stderr.join("\n")).toContain("usage: collie stt whistle");
      expect(calls).toBe(0);
    }
  });

  test("the parent verb lists it, and routes to it", async () => {
    const d = deps();
    expect(await cmdStt(d, ["help"])).toBe(EXIT.USAGE);
    expect(d.io.stderr.join("\n")).toContain("whistle");
    const routed = deps();
    expect(await cmdStt(routed, ["whistle"])).toBe(EXIT.OK);
    expect(calls).toBe(1);
  });
});

describe("collie stt status and off, with Whistle", () => {
  const ON = () => ({ [sttJson()]: JSON.stringify({ provider: "whistle" }) });

  test("the host engine is Whistle and the model is ready: engine line and model line", async () => {
    await cmdSttWhistle(deps(), []);
    const d = deps({ seed: ON() });
    expect(await cmdSttStatus(d)).toBe(EXIT.OK);
    expect(said(d)).toContain("engine");
    expect(said(d)).toContain("Collie's own");
    expect(said(d)).toMatch(/model +ready — \d+\.\d MB, sha256 [0-9a-f]{8}…, revision ca528760/);
  });

  test("the host engine is Whistle and there is no model: the model line says absent and how to fetch it", async () => {
    const d = deps({ seed: ON() });
    await cmdSttStatus(d);
    expect(said(d)).toMatch(/model +absent — `collie stt whistle` fetches it/);
  });

  test("a model this release does not accept, and one that cannot be read", async () => {
    const paths = whistlePaths(stateDir);
    mkdirSync(paths.dir, { recursive: true });
    writeFileSync(paths.model, "some other model");
    const odd = deps({ seed: ON() });
    await cmdSttStatus(odd);
    expect(said(odd)).toContain("does not match this release");

    if (process.platform === "win32") return;
    rmSync(paths.model);
    symlinkSync(join(stateDir, "x"), paths.model);
    const link = deps({ seed: ON() });
    await cmdSttStatus(link);
    expect(said(link)).toContain("unreadable");
  });

  test("a download in flight reads as downloading", async () => {
    otherDownload("12345");
    const d = deps({ seed: ON() });
    await cmdSttStatus(d);
    expect(said(d)).toMatch(/model +downloading — 0\.0 MB of 0\.0 MB/);
  });

  test("another provider with a held model shows the model as not the engine; no model shows nothing", async () => {
    const other = { [sttJson()]: JSON.stringify({ provider: "local-cli", command: "/opt/engine" }) };
    const none = deps({ seed: other });
    none.commandProblem = () => null;
    await cmdSttStatus(none);
    expect(said(none)).not.toContain("whistle ");

    await cmdSttWhistle(deps(), []);
    const held = deps({ seed: other });
    held.commandProblem = () => null;
    await cmdSttStatus(held);
    expect(said(held)).toMatch(/whistle +ready — .*not this host's engine/);
  });

  test("off with the Whistle provider says the model stays and how to remove it", async () => {
    await cmdSttWhistle(deps(), []);
    const d = deps({ seed: ON() });
    expect(cmdSttOff(d)).toBe(EXIT.OK);
    expect(said(d)).toContain("The Whistle model stays");
    expect(said(d)).toContain("collie stt whistle --remove");
    expect(existsSync(whistlePaths(stateDir).model)).toBe(true);
  });

  test("off with another provider says nothing about Whistle", () => {
    const d = deps({ seed: { [sttJson()]: JSON.stringify({ provider: "local-cli", command: "/opt/engine" }) } });
    expect(cmdSttOff(d)).toBe(EXIT.OK);
    expect(said(d)).not.toContain("Whistle");
  });
});
