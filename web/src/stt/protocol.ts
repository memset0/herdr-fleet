// The messages between the page (lib/stt-engine.ts) and the speech worker (stt/worker.ts), ADR 0096.
//
// Types only, so the page can name them without pulling worker code into the main bundle. Every
// request carries an `id`, and every answer to a request echoes it: the page drops an answer whose
// id is not the one it waits for. The two boot messages, `ready` and `unsupported`, answer no
// request and carry no id.

/** Page to worker. The buffers are transferred, so the sender's copies are detached afterwards. */
export type SttWorkerRequest =
  | {
      type: "load";
      id: number;
      /** The bytes of `needle.wasm`. The worker hashes them before anything compiles them. */
      wasm: ArrayBuffer;
      /** The bytes of `whistle.cact`. Hashed against the accepted list before the load. */
      model: ArrayBuffer;
    }
  | {
      type: "transcribe";
      id: number;
      /** 16 kHz mono PCM in [-1, 1]. */
      pcm: Float32Array;
    };

/** Why the worker will not run the engine on this browser. Fixed for the browser, not the clip. */
export type SttUnsupportedReason =
  /** The eight-byte probe module did not compile: the worker did not get its own policy, or the
   *  browser does not know `'wasm-unsafe-eval'`, or there is no WebAssembly at all. */
  | "wasm-csp"
  /** The vendored glue did not load, or did not define `createNeedle`. */
  | "glue-failed";

export type SttWorkerErrorCode =
  /** `needle.wasm` is not the pinned file. Nothing was compiled. */
  | "wasm-hash"
  /** The model is not one this build accepts. Nothing was compiled. */
  | "model-hash"
  /** The engine did not start, or did not take the model. */
  | "load-failed"
  /** A transcribe arrived before a load succeeded. */
  | "not-loaded"
  /** The engine ran out of memory: a failed heap growth, an allocation that came back empty, or a
   *  RangeError while it grew. */
  | "oom"
  /** The engine ran and did not give back a transcript. */
  | "transcribe-failed"
  /** A request of a known type with a field of the wrong shape. */
  | "bad-request";

/**
 * A message to the worker as it arrives, before the worker has checked a field. `MessageEvent.data`
 * is `any`; every field here is optional and is read through `instanceof` or `Number.isSafeInteger`,
 * never trusted from the type, so a message of any other form simply fails those checks.
 */
export interface SttWorkerInbound {
  type?: string;
  id?: number;
  wasm?: ArrayBuffer;
  model?: ArrayBuffer;
  pcm?: Float32Array;
}

/** A message from the worker as it arrives, before the page has checked a field. Read the same way,
 *  through lib/json.ts's tag checks, in lib/stt-engine.ts. */
export interface SttPageInbound {
  type?: string;
  id?: number;
  reason?: string;
  text?: string;
  language?: string;
  code?: string;
}

/** Worker to page. */
export type SttWorkerReply =
  | { type: "ready" }
  | { type: "unsupported"; reason: SttUnsupportedReason }
  | { type: "loaded"; id: number }
  | { type: "result"; id: number; text: string; language: string }
  | { type: "error"; id: number; code: SttWorkerErrorCode };
