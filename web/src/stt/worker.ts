// The speech worker (ADR 0096 Decision 8). A CLASSIC dedicated worker: the vendored glue is a classic
// script that defines the global `createNeedle`, so it is loaded with `importScripts`, not `import`.
// Vite builds this file as an IIFE to `stt/worker-<hash>.js` (vite.config.ts, `worker`), and the bridge
// serves every `.js` under `stt/` with the one policy that allows wasm:
//
//     default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; base-uri 'none'
//
// A dedicated worker loaded from a URL runs under its own response's policy, not its creator's, so
// the document's policy never gains `'wasm-unsafe-eval'`. A `blob:` worker would inherit the
// document's policy, so this worker is only ever made from its URL (lib/stt-engine.ts).
//
// All logic is in worker-core.ts. This file only binds it to the worker global, and it must stay
// free of any network call: the policy has no `connect-src`, and this code needs none.

import type { SttWorkerInbound } from "./protocol";
import { createWorkerCore, type CreateNeedle } from "./worker-core";

// `createNeedle` is the one global the vendored glue defines, once `importScripts` has run it. Its
// type is the Emscripten factory whose surface `NeedleModule` describes, at the pinned commit; the
// pins test holds the glue to those bytes. Before the glue runs, or when it did not run, it is absent.
declare const self: DedicatedWorkerGlobalScope & { createNeedle?: CreateNeedle };

// An out-of-memory on a phone does not say so. The glue grows the heap inside a try/catch that
// swallows the failure, `malloc` then returns NULL, C++ `new` throws, and the glue aborts with an
// empty message. Noting the failed growth here is the only honest way to tell that abort from any
// other, so the page can say "not enough memory" rather than "the engine failed". Wrapped in this
// worker's own realm only; the page's `WebAssembly` is untouched.
let growFailed = false;
if ("WebAssembly" in globalThis) {
  const grow = WebAssembly.Memory.prototype.grow;
  WebAssembly.Memory.prototype.grow = function watchedGrow(this: WebAssembly.Memory, delta: number): number {
    try {
      return grow.call(this, delta);
    } catch (error) {
      growFailed = true;
      throw error;
    }
  };
}

const core = createWorkerCore({
  compile: (bytes) => WebAssembly.compile(bytes),
  importGlue(url) {
    importScripts(url);
    return self.createNeedle ?? null;
  },
  workerUrl: self.location.href,
  digest: (bytes) => crypto.subtle.digest("SHA-256", bytes),
  // Nothing is transferred back: a reply is a few short strings.
  post: (reply) => self.postMessage(reply, []),
  growFailed: () => growFailed,
  resetGrowFailed: () => {
    growFailed = false;
  },
});

self.addEventListener("message", (event: MessageEvent) => {
  // SAFETY: `MessageEvent.data` is `any`, a structured clone from the page that made this dedicated
  // worker, the only thing that can post to it. SttWorkerInbound makes every field optional, and the
  // core checks each one with `instanceof` or `Number.isSafeInteger` before it uses it.
  core.receive(event.data as SttWorkerInbound | null);
});
void core.boot();
