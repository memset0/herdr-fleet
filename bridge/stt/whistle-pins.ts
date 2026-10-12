// The pins for the Whistle speech engine and its model: one place that says exactly which bytes
// Collie runs. ADR 0096 Decision 6 explains why they are pinned and how they are re-vendored.
//
// `web/src/stt/pins.ts` mirrors the values the phone needs (the web build never imports bridge
// code). `whistle-pins.test.ts` hashes the vendored files and fails when either file drifts.

/** The directory under `web/public/stt/` that holds the vendored needle engine. */
export const NEEDLE_VERSION_DIR = "needle-3-93e88ede";

/** `needle.js`, the Emscripten glue, byte for byte as `Cactus-Compute/needle3` published it. */
export const NEEDLE_JS_SHA256 = "964681b2a5ec3c4db2f06e45a5b60c8981a7d4ab4cac16ef6bf5b1988657a5f1";
export const NEEDLE_JS_BYTES = 63072;

/** `needle.wasm`, the engine, from the same commit. */
export const NEEDLE_WASM_SHA256 = "70bdb02b80d062b52cab1597e508b71172a7b355fc448840077a3929170a0733";
export const NEEDLE_WASM_BYTES = 929343;

/**
 * Everything the wasm asks its host for, as the import section spells it: module and name.
 *
 * The build minified the names. The glue's `wasmImports` object maps them back, in this order:
 * a ___cxa_throw, b _fd_close, c _fd_write, d ___syscall_fcntl64, e __abort_js, f __munmap_js,
 * g _fd_seek, h _fd_read, i ___syscall_ioctl, j _environ_get, k _environ_sizes_get,
 * l _clock_time_get, m _emscripten_resize_heap, n ___syscall_rmdir, o ___syscall_unlinkat,
 * p ___syscall_openat. A new import is a reason to stop and read, not to edit this list.
 */
export const WASM_IMPORTS: readonly { readonly module: string; readonly name: string }[] = [
  { module: "a", name: "a" },
  { module: "a", name: "b" },
  { module: "a", name: "c" },
  { module: "a", name: "d" },
  { module: "a", name: "e" },
  { module: "a", name: "f" },
  { module: "a", name: "g" },
  { module: "a", name: "h" },
  { module: "a", name: "i" },
  { module: "a", name: "j" },
  { module: "a", name: "k" },
  { module: "a", name: "l" },
  { module: "a", name: "m" },
  { module: "a", name: "n" },
  { module: "a", name: "o" },
  { module: "a", name: "p" },
];

/** The model the host fetches once, pinned to a Hugging Face revision. */
export const WHISTLE_MODEL = {
  url: "https://huggingface.co/Cactus-Compute/whistle/resolve/ca5287601bef25af26dcf2e1b2bdc0843a7c19e5/whistle.cact",
  revision: "ca5287601bef25af26dcf2e1b2bdc0843a7c19e5",
  sha256: "b6e02f048568ac5d01a2042556c658061e699acbc0aa2a1439f52f3d461dffeb",
  bytes: 16919407,
} as const;

/** Every model hash the engine accepts. One entry today; a second one means a human read the change. */
export const ACCEPTED_WHISTLE_SHAS: readonly string[] = [WHISTLE_MODEL.sha256];
