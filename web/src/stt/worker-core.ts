// The speech worker's logic, apart from the worker global so a test can drive it with fakes (ADR 0096
// Decision 8). `stt/worker.ts` binds it to `self`; nothing else should.
//
// TWO ORDERS ARE THE SECURITY OF THIS FILE, AND BOTH ARE TESTED.
//
// 1. The probe before the glue. `boot` compiles an eight-byte module before it loads any engine
//    code. The worker runs under the policy its own response carries; a browser that gave it the
//    document's policy instead, or does not know `'wasm-unsafe-eval'`, refuses that compile, and the
//    worker says `unsupported` and loads nothing. Fail closed: the answer to a refusal is the Host
//    engine, never a wider document policy.
// 2. The hashes before the compile. `load` hashes the wasm against the pin and the model against
//    the accepted list, and only then calls `createNeedle`. A file that is not the pinned file is
//    never compiled, whoever handed it in.
//
// The glue is the vendored `needle.js`, a classic script that defines one global, `createNeedle`.
// It is our origin's own static file and it is loaded the way any of our scripts is; its only
// network uses are a fetch of the wasm when no `wasmBinary` is passed and a synchronous XHR for lazy
// files. `wasmBinary` is always passed and no lazy file exists, and the worker's policy has no
// `connect-src` anyway. This file itself fetches nothing.

import { asJsonString, parseJsonObject } from "@/lib/json";

import { ACCEPTED_WHISTLE_SHAS, NEEDLE_VERSION_DIR, NEEDLE_WASM_SHA256 } from "./pins";
import type { SttWorkerErrorCode, SttWorkerInbound, SttWorkerReply } from "./protocol";

/** The room the engine gets for its JSON answer. A transcript of five minutes is far below it. */
export const TRANSCRIPT_CAPACITY = 65_536;

/** The smallest valid module: the magic `\0asm` and version 1. Compiling it costs nothing and
 *  touches no engine code, so it asks the one question that matters: may this worker compile wasm? */
export function probeModule(): Uint8Array<ArrayBuffer> {
  return new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
}

/** The glue's address, relative to the worker's own, so the engine works under a mount (ADR 0052).
 *  The worker is `stt/worker-<hash>.js`; the glue is `stt/<version dir>/needle.js`. */
export function glueUrl(workerUrl: string): string {
  return new URL(`./${NEEDLE_VERSION_DIR}/needle.js`, workerUrl).href;
}

/** The part of the Emscripten module the worker calls. Pointers are numbers; the model size is a
 *  u64, so it crosses as a BigInt. */
export interface NeedleModule {
  HEAPU8: Uint8Array;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  _needle_load: (ptr: number, size: bigint) => number;
  _needle_transcribe: (
    pcm: number,
    samples: number,
    language: number,
    keywords: number,
    wordTimestamps: number,
    out: number,
    capacity: number,
  ) => number;
}

export type CreateNeedle = (options: { wasmBinary: Uint8Array }) => Promise<NeedleModule>;

/** What the worker global gives the core. `stt/worker.ts` is the one real implementation. */
export interface WorkerHost {
  /** `WebAssembly.compile`. */
  compile: (bytes: Uint8Array<ArrayBuffer>) => Promise<WebAssembly.Module>;
  /** Run the glue at this absolute URL (`importScripts`) and return the `createNeedle` it defined,
   *  or `null` when it defined none. Throws when the script did not load. */
  importGlue: (url: string) => CreateNeedle | null;
  /** The worker's own URL, the base for the glue's address. */
  workerUrl: string;
  /** `crypto.subtle.digest("SHA-256", bytes)`. */
  digest: (bytes: ArrayBuffer) => Promise<ArrayBuffer>;
  post: (reply: SttWorkerReply) => void;
  /** True when a heap growth failed since the last reset. That is what makes a bare Emscripten
   *  abort an out-of-memory: on a full heap `malloc` returns NULL, C++ `new` throws, and the glue's
   *  `___cxa_throw` aborts with no message. */
  growFailed: () => boolean;
  resetGrowFailed: () => void;
}

export interface WorkerCore {
  /** The probe, then the glue. Posts `ready` or `unsupported`. Call once, at start. */
  boot: () => Promise<void>;
  /** One message from the page, unchecked. Handled strictly one at a time, after `boot`. */
  receive: (message: SttWorkerInbound | null) => void;
  /** Resolves when everything received so far has been handled. For tests. */
  idle: () => Promise<void>;
}

function hex(digest: ArrayBuffer): string {
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The engine's JSON answer, read out of the heap before the buffer is freed. `null` when there is
 *  no terminating zero inside the capacity, or the JSON is not the documented shape. */
export function readTranscript(
  heap: Uint8Array,
  ptr: number,
  capacity: number,
): { text: string; language: string } | null {
  const window = heap.subarray(ptr, ptr + capacity);
  const end = window.indexOf(0);
  if (end < 0) return null;
  const answer = parseJsonObject(new TextDecoder().decode(window.subarray(0, end)));
  const text = asJsonString(answer?.text);
  if (text === undefined) return null;
  return { text: text.trim(), language: asJsonString(answer?.language) ?? "" };
}

const OOM_MESSAGE = /\bOOM\b|out of memory|Cannot enlarge memory/i;

export function createWorkerCore(host: WorkerHost): WorkerCore {
  let createNeedle: CreateNeedle | null = null;
  let needle: NeedleModule | null = null;
  // Every message waits for the one before it and for boot: a transcribe that arrives while the
  // load is still hashing must not run against a half-loaded engine.
  let queue: Promise<void> = Promise.resolve();

  function fail(id: number, code: SttWorkerErrorCode): void {
    host.post({ type: "error", id, code });
  }

  /** An exception out of the engine. Whatever it was, the Emscripten module has aborted or is in an
   *  unknown state, so it is dropped; the page recycles the worker on any error. */
  function failFromThrow(id: number, cause: unknown, fallback: SttWorkerErrorCode): void {
    needle = null;
    const oom =
      cause instanceof RangeError ||
      host.growFailed() ||
      (cause instanceof Error && OOM_MESSAGE.test(cause.message));
    fail(id, oom ? "oom" : fallback);
  }

  async function boot(): Promise<void> {
    try {
      await host.compile(probeModule());
    } catch {
      host.post({ type: "unsupported", reason: "wasm-csp" });
      return;
    }
    try {
      createNeedle = host.importGlue(glueUrl(host.workerUrl));
    } catch {
      createNeedle = null;
    }
    if (createNeedle === null) {
      host.post({ type: "unsupported", reason: "glue-failed" });
      return;
    }
    host.post({ type: "ready" });
  }

  async function load(id: number, wasm: ArrayBuffer, model: ArrayBuffer): Promise<void> {
    if (needle !== null) {
      host.post({ type: "loaded", id });
      return;
    }
    if (createNeedle === null) {
      fail(id, "load-failed");
      return;
    }
    if (hex(await host.digest(wasm)) !== NEEDLE_WASM_SHA256) {
      fail(id, "wasm-hash");
      return;
    }
    if (!ACCEPTED_WHISTLE_SHAS.includes(hex(await host.digest(model)))) {
      fail(id, "model-hash");
      return;
    }
    host.resetGrowFailed();
    let engine: NeedleModule;
    try {
      engine = await createNeedle({ wasmBinary: new Uint8Array(wasm) });
    } catch (error) {
      failFromThrow(id, error, "load-failed");
      return;
    }
    try {
      const ptr = engine._malloc(model.byteLength);
      if (ptr === 0) {
        fail(id, "oom");
        return;
      }
      engine.HEAPU8.set(new Uint8Array(model), ptr);
      const rc = engine._needle_load(ptr, BigInt(model.byteLength));
      // `needle_load` keeps its own copy: measured 2026-10-11 by zeroing and freeing these bytes
      // after the load, with the same transcript after. Freeing them gives back 17 MB of heap.
      engine._free(ptr);
      if (rc !== 0) {
        fail(id, "load-failed");
        return;
      }
    } catch (error) {
      failFromThrow(id, error, "load-failed");
      return;
    }
    needle = engine;
    host.post({ type: "loaded", id });
  }

  function transcribe(id: number, pcm: Float32Array): void {
    const engine = needle;
    if (engine === null) {
      fail(id, "not-loaded");
      return;
    }
    if (pcm.length === 0) {
      host.post({ type: "result", id, text: "", language: "" });
      return;
    }
    host.resetGrowFailed();
    try {
      const pcmPtr = engine._malloc(pcm.byteLength);
      if (pcmPtr === 0) {
        fail(id, "oom");
        return;
      }
      const outPtr = engine._malloc(TRANSCRIPT_CAPACITY);
      if (outPtr === 0) {
        engine._free(pcmPtr);
        fail(id, "oom");
        return;
      }
      // HEAPU8 is read fresh at each use: a heap growth replaces the buffer under it.
      engine.HEAPU8.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), pcmPtr);
      engine.HEAPU8.fill(0, outPtr, outPtr + 1);
      const tokens = engine._needle_transcribe(pcmPtr, pcm.length, 0, 0, 0, outPtr, TRANSCRIPT_CAPACITY);
      const answer = tokens < 0 ? null : readTranscript(engine.HEAPU8, outPtr, TRANSCRIPT_CAPACITY);
      engine._free(pcmPtr);
      engine._free(outPtr);
      if (answer === null) {
        fail(id, "transcribe-failed");
        return;
      }
      host.post({ type: "result", id, text: answer.text, language: answer.language });
    } catch (error) {
      failFromThrow(id, error, "transcribe-failed");
    }
  }

  async function handle(message: SttWorkerInbound | null): Promise<void> {
    // Optional chaining, not destructuring: a message of `undefined` must be dropped, not thrown on.
    const type = message?.type;
    const id = message?.id;
    // Without a usable id there is nobody to answer, so the message is dropped, as is an unknown type.
    // `Number.isSafeInteger` is false for anything that is not a number, whatever the type says.
    if (id === undefined || !Number.isSafeInteger(id)) return;
    if (type === "load") {
      const wasm = message?.wasm;
      const model = message?.model;
      if (!(wasm instanceof ArrayBuffer) || !(model instanceof ArrayBuffer)) {
        fail(id, "bad-request");
        return;
      }
      // A rejected digest is the one throw `load` does not answer itself.
      await load(id, wasm, model).catch(() => fail(id, "load-failed"));
      return;
    }
    if (type === "transcribe") {
      const pcm = message?.pcm;
      if (!(pcm instanceof Float32Array)) {
        fail(id, "bad-request");
        return;
      }
      transcribe(id, pcm);
    }
  }

  return {
    boot() {
      const booted = queue.then(boot);
      queue = booted;
      return booted;
    },
    receive(message) {
      // `handle` posts its own errors; a throw here would be a bug in this file, and it must not
      // stop the queue for the messages behind it.
      queue = queue.then(() => handle(message)).catch(() => {});
    },
    idle: () => queue,
  };
}
