import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { encodeWav16 } from "../bridge/stt/wav.ts";
import { whistlePaths } from "../bridge/stt/whistle-model.ts";
import { NEEDLE_VERSION_DIR } from "../bridge/stt/whistle-pins.ts";
import { EXIT, type Io } from "./io.ts";
import { cmdWhistleTranscribe, readAnswer, transcribe, type CreateNeedle, type NeedleModule } from "./whistle-transcribe.ts";

// The hidden verb. The refusals run everywhere; the real engine runs only where the measured model
// is on disk, named by COLLIE_TEST_WHISTLE_DIR (a folder holding `whistle.cact` and `1.wav`, as
// /tmp/whistle-dl did on 2026-10-11). The model is never committed, so CI skips that case.

const checkout = join(import.meta.dir, "..");
let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "collie-whistle-verb-"));
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function captureIo() {
  const out: string[] = [];
  const err: string[] = [];
  const io: Io = {
    out: (line) => {
      out.push(line);
    },
    err: (line) => {
      err.push(line);
    },
  };
  return { io, out, err };
}

function wavFile(): string {
  const path = join(root, "recording.wav");
  writeFileSync(path, encodeWav16(new Float32Array(1600)));
  return path;
}

describe("collie _whistle-transcribe — refusals", () => {
  test("it takes exactly one path", async () => {
    const c = captureIo();
    expect(await cmdWhistleTranscribe([], { io: c.io, env: {} })).toBe(EXIT.USAGE);
    expect(await cmdWhistleTranscribe(["a", "b"], { io: c.io, env: {} })).toBe(EXIT.USAGE);
    expect(c.out).toEqual([]);
  });

  test("glue that is not the pinned glue is refused before anything is compiled", async () => {
    const fake = join(root, "fake-root");
    const engine = join(fake, "web", "public", "stt", NEEDLE_VERSION_DIR);
    mkdirSync(engine, { recursive: true });
    // If this ran, it would print to stdout and the test would see it.
    writeFileSync(join(engine, "needle.js"), 'process.stdout.write("RAN"); module.exports = () => {};');
    copyFileSync(join(checkout, "web", "public", "stt", NEEDLE_VERSION_DIR, "needle.wasm"), join(engine, "needle.wasm"));
    const c = captureIo();
    expect(await cmdWhistleTranscribe([wavFile()], { io: c.io, env: { COLLIE_STATE_DIR: join(root, "state") }, root: fake })).toBe(EXIT.FAIL);
    expect(c.err).toEqual(["error: the engine glue does not match its pin"]);
    expect(c.out).toEqual([]);
  });

  test("no model, a wrong model, or a symlinked model is refused", async () => {
    const state = join(root, "state-model");
    const env = { COLLIE_STATE_DIR: state };
    const c = captureIo();
    expect(await cmdWhistleTranscribe([wavFile()], { io: c.io, env, root: checkout })).toBe(EXIT.FAIL);
    expect(c.err.at(-1)).toBe("error: the Whistle model cannot be read");

    const paths = whistlePaths(state);
    mkdirSync(paths.dir, { recursive: true });
    writeFileSync(paths.model, "not the model");
    expect(await cmdWhistleTranscribe([wavFile()], { io: c.io, env, root: checkout })).toBe(EXIT.FAIL);
    expect(c.err.at(-1)).toBe("error: the Whistle model does not match its pin");

    if (process.platform === "win32") return;
    rmSync(paths.model);
    symlinkSync(join(root, "elsewhere"), paths.model);
    expect(await cmdWhistleTranscribe([wavFile()], { io: c.io, env, root: checkout })).toBe(EXIT.FAIL);
    expect(c.err.at(-1)).toBe("error: the Whistle model is a symlink; it is not followed");
    expect(c.out).toEqual([]);
  });
});

describe("collie _whistle-transcribe — reading the engine's answer", () => {
  const CAPACITY = 64 * 1024;

  /** An engine whose heap is full of old bytes, and whose transcribe writes `answer` as given. */
  function fakeEngine(answer: Uint8Array): CreateNeedle {
    const heap = new Uint8Array(4 * CAPACITY).fill(0x41);
    let next = 16;
    const engine: NeedleModule = {
      HEAPU8: heap,
      _malloc: (bytes) => {
        const at = next;
        next += bytes;
        return at;
      },
      _free: () => undefined,
      _needle_load: () => 0,
      _needle_transcribe: (_pcm, _samples, _a, _b, _c, out) => {
        heap.set(answer, out);
        return answer.byteLength;
      },
    };
    return async () => engine;
  }

  const run = (answer: Uint8Array) =>
    transcribe(
      fakeEngine(answer),
      new Uint8Array(1),
      new Uint8Array(8),
      new Float32Array(4),
      captureIo().io,
    );

  test("an answer the engine did not terminate ends at the zeroed buffer, not in old heap bytes", async () => {
    expect(await run(new TextEncoder().encode('{"text":" hello "}'))).toBe("hello");
  });

  test("an answer that fills the whole buffer with no zero is refused, and nothing past it is read", async () => {
    await expect(run(new Uint8Array(CAPACITY).fill(0x20))).rejects.toThrow("the engine's answer did not end inside its buffer");
    const heap = new Uint8Array(CAPACITY + 8).fill(0x7b);
    heap[CAPACITY + 4] = 0;
    expect(() => readAnswer(heap, 0, CAPACITY)).toThrow("the engine's answer did not end inside its buffer");
    expect(readAnswer(new Uint8Array([0x61, 0x62, 0, 0x63]), 0, 4)).toBe("ab");
  });
});

const measured = process.env.COLLIE_TEST_WHISTLE_DIR;

describe.skipIf(measured === undefined)("collie _whistle-transcribe — the real engine, end to end", () => {
  test("a child of this checkout's CLI turns 10.4 s of speech into text", async () => {
    const dir = measured!;
    const state = join(root, "state-real");
    const paths = whistlePaths(state);
    mkdirSync(paths.dir, { recursive: true });
    copyFileSync(join(dir, "whistle.cact"), paths.model);

    // A real child, spawned the way the provider spawns it: argv only, the two variables set.
    const started = performance.now();
    const child = Bun.spawn([process.execPath, join(checkout, "cli", "main.ts"), "_whistle-transcribe", join(dir, "1.wav")], {
      env: { PATH: process.env.PATH ?? "", COLLIE_STATE_DIR: state, COLLIE_PLUGIN_ROOT: checkout },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    const elapsed = Math.round(performance.now() - started);
    console.log(`[whistle e2e] ${elapsed} ms: ${JSON.stringify(stdout.trim())}`);

    expect(code).toBe(0);
    expect(stdout.trim().toLowerCase()).toContain("stew for dinner");
    expect(stdout.trim()).toBe(stdout.replace(/\n$/, ""));
    expect(stderr).not.toContain("error:");
  }, 60_000);
});
