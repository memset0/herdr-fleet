import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { collieSelfCommand } from "../root.ts";
import { childRunner, LocalCliEmptyTranscriptError } from "./local-cli.ts";
import { SttError, type SttAudio } from "./provider.ts";
import { encodeWav16 } from "./wav.ts";
import { createWhistleSttProvider, WHISTLE_VERB, whistleChildEnv, whistleTimeoutFor } from "./whistle.ts";
import { resetWhistleModelState, whistlePaths } from "./whistle-model.ts";
import { WHISTLE_MODEL } from "./whistle-pins.ts";

// The whistle provider against a FAKE Collie: `self` is this very Bun running a small script, so the
// child is real (the argv, the env, the temp file, the bounds) and the engine is not. The real
// engine runs in cli/whistle-transcribe.test.ts, behind COLLIE_TEST_WHISTLE_DIR.

let root: string;
let stateDir: string;
let tmpRoot: string;
let script: string;
let report: string;
const checkout = join(import.meta.dir, "..", "..");

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "collie-whistle-provider-"));
  stateDir = join(root, "state");
  tmpRoot = join(root, "tmp");
  script = join(root, "fake-collie.ts");
  report = join(root, "report.json");
  for (const dir of [stateDir, tmpRoot]) mkdirSync(dir, { recursive: true });
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});
beforeEach(() => resetWhistleModelState());

/** A fake `collie` that records its argv and env, then prints `out`. */
function fakeCollie(out: string): readonly string[] {
  writeFileSync(
    script,
    `
import { readFileSync, writeFileSync } from "node:fs";
const argv = process.argv.slice(2);
writeFileSync(${JSON.stringify(report)}, JSON.stringify({
  argv,
  bytes: readFileSync(argv[argv.length - 1]).length,
  collieEnv: Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith("COLLIE_"))),
}));
process.stdout.write(${JSON.stringify(out)});
`,
  );
  return [process.execPath, script];
}

const wav = (): SttAudio => ({ audio: encodeWav16(new Float32Array(1600)), mimeType: "audio/wav", filename: "recording.wav" });

describe("the whistle provider", () => {
  test("spawns Collie's own CLI with the fixed argv, and only the two COLLIE_ variables it sets", async () => {
    const provider = createWhistleSttProvider({
      stateDir,
      root: checkout,
      self: fakeCollie("  hello from whistle \n"),
      env: { PATH: process.env.PATH, COLLIE_PUSH_PRIVATE_KEY: "do-not-pass", COLLIE_STT_KEY: "nor-this", COLLIE_STATE_DIR: "/the/bridge/env/one" },
      tmpRoot,
    });
    expect(await provider.transcribe(wav())).toEqual({ text: "hello from whistle" });

    // SAFETY: the fake collie's own JSON.stringify of exactly this shape.
    const seen = JSON.parse(readFileSync(report, "utf8")) as { argv: string[]; bytes: number; collieEnv: Record<string, string> };
    expect(seen.argv.slice(0, 1)).toEqual([WHISTLE_VERB]);
    expect(seen.argv).toHaveLength(2);
    expect(seen.argv[1]!.endsWith("recording.wav")).toBe(true);
    expect(seen.bytes).toBe(44 + 3200);
    // Set by the bridge from what it resolved, never copied from its own environment.
    expect(seen.collieEnv).toEqual({ COLLIE_STATE_DIR: stateDir, COLLIE_PLUGIN_ROOT: checkout });
    expect(readdirSync(tmpRoot)).toEqual([]);
  });

  test("the child env drops every COLLIE_ name and keeps the rest", () => {
    const env: Record<string, string> = whistleChildEnv({ HOME: "/h", COLLIE_X: "1", UNSET: undefined }, "/s", "/r");
    expect(env).toEqual({
      HOME: "/h",
      COLLIE_STATE_DIR: "/s",
      COLLIE_PLUGIN_ROOT: "/r",
    });
  });

  test("an empty transcript and a failing child are Collie's own sentences", async () => {
    const quiet = createWhistleSttProvider({ stateDir, root: checkout, self: fakeCollie(""), tmpRoot });
    await expect(quiet.transcribe(wav())).rejects.toBeInstanceOf(LocalCliEmptyTranscriptError);
    await expect(quiet.transcribe(wav())).rejects.toThrow("the Whistle engine printed no transcript");

    writeFileSync(join(root, "fail.ts"), 'process.stderr.write("/secret/path broke"); process.exit(3);');
    const failing = createWhistleSttProvider({ stateDir, root: checkout, self: [process.execPath, join(root, "fail.ts")], tmpRoot });
    await expect(failing.transcribe(wav())).rejects.toThrow(new SttError("refused", "the Whistle engine exited with status 3"));
  });

  test("the deadline kills the child", async () => {
    writeFileSync(join(root, "hang.ts"), "await Bun.sleep(30_000);");
    const hung = createWhistleSttProvider({ stateDir, root: checkout, self: [process.execPath, join(root, "hang.ts")], tmpRoot, timeoutMs: 300 });
    await expect(hung.transcribe(wav())).rejects.toMatchObject({ kind: "timeout" });
  });

  test("the deadline scales with the clip: half its length, at least 60 s, at most 3 minutes", () => {
    const clip = (seconds: number) => encodeWav16(new Float32Array(seconds * 16_000));
    expect(whistleTimeoutFor(clip(1))).toBe(60_000);
    expect(whistleTimeoutFor(clip(120))).toBe(60_000);
    // The four-minute clip this provider accepts gets two minutes, not the flat one.
    expect(whistleTimeoutFor(clip(240))).toBe(120_000);
    expect(whistleTimeoutFor(clip(500))).toBe(180_000);
    // Bytes that are not the WAV shape get the floor; the child refuses them anyway.
    expect(whistleTimeoutFor(new TextEncoder().encode("not a wav at all"))).toBe(60_000);
  });

  test("a call's own deadline replaces the runner's", async () => {
    writeFileSync(join(root, "hang.ts"), "await Bun.sleep(30_000);");
    const run = childRunner({ env: { PATH: process.env.PATH ?? "" }, noun: "the Whistle engine", tmpRoot, timeoutMs: 30_000 });
    const started = performance.now();
    await expect(run(() => [process.execPath, join(root, "hang.ts")], "recording.wav", wav(), undefined, 300)).rejects.toMatchObject({ kind: "timeout" });
    expect(performance.now() - started).toBeLessThan(10_000);
  });

  test("available only with an accepted model and the engine files in place", async () => {
    const dir = mkdtempSync(join(tmpdir(), "collie-whistle-status-"));
    const provider = createWhistleSttProvider({ stateDir: dir, root: checkout, self: ["unused"] });
    expect(await provider.status()).toEqual({ available: false, reason: "the Whistle model is not on the host" });

    // A file that is not the pinned model does not count.
    const paths = whistlePaths(dir);
    mkdirSync(paths.dir, { recursive: true });
    writeFileSync(paths.model, "not whistle");
    expect((await provider.status()).available).toBe(false);
    expect(createHash("sha256").update("not whistle").digest("hex")).not.toBe(WHISTLE_MODEL.sha256);

    // The engine missing (a root with no web tree) is its own reason, once the model is there. The
    // real model is never committed, so this half runs only where the measured copy exists.
    const real = process.env.COLLIE_TEST_WHISTLE_DIR;
    if (real !== undefined) {
      writeFileSync(paths.model, readFileSync(join(real, "whistle.cact")));
      resetWhistleModelState();
      expect(await provider.status()).toEqual({ available: true });
      const bare = createWhistleSttProvider({ stateDir: dir, root: dir, self: ["unused"] });
      expect(await bare.status()).toEqual({ available: false, reason: "the Whistle engine files are missing from this install" });
    }
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("collieSelfCommand — the child is this Collie", () => {
  test("from source it is Bun plus the CLI entry in this module's checkout", () => {
    expect(collieSelfCommand("/repo/bridge/root.ts", "/usr/bin/bun")).toEqual(["/usr/bin/bun", join("/repo", "cli", "main.ts")]);
  });

  test("compiled it is the running binary alone", () => {
    expect(collieSelfCommand("/$bunfs/root/collie", "/opt/collie/bin/collie")).toEqual(["/opt/collie/bin/collie"]);
    expect(collieSelfCommand("B:\\~BUN\\root\\collie.exe", "C:\\collie\\bin\\collie.exe")).toEqual(["C:\\collie\\bin\\collie.exe"]);
  });
});

const measured = process.env.COLLIE_TEST_WHISTLE_DIR;

// The whole chain with the real engine: the provider spawns this checkout's own CLI (source mode),
// which checks the pins, loads the model from the state dir it was told about, and prints the text.
describe.skipIf(measured === undefined)("the whistle provider — the real engine, end to end", () => {
  test("a 13 s WAV becomes text through a real child of this Collie", async () => {
    const dir = mkdtempSync(join(tmpdir(), "collie-whistle-e2e-"));
    const paths = whistlePaths(dir);
    mkdirSync(paths.dir, { recursive: true });
    writeFileSync(paths.model, readFileSync(join(measured!, "whistle.cact")));
    const provider = createWhistleSttProvider({ stateDir: dir, root: checkout, tmpRoot });
    expect(await provider.status()).toEqual({ available: true });
    const audio = new Uint8Array(readFileSync(join(measured!, "mlk.wav")));
    const started = performance.now();
    const { text } = await provider.transcribe({ audio, mimeType: "audio/wav", filename: "recording.wav" });
    console.log(`[whistle provider e2e] ${Math.round(performance.now() - started)} ms: ${JSON.stringify(text)}`);
    expect(text.toLowerCase()).toContain("i have a dream");
    expect(readdirSync(tmpRoot)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  }, 60_000);
});
