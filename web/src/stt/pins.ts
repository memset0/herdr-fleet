// The phone's copy of the engine and model pins, see ADR 0096 Decision 6. The web build never
// imports bridge code, so these values are written out again. `bridge/stt/whistle-pins.test.ts`
// reads this file as text and fails when a value differs from `bridge/stt/whistle-pins.ts`.
// Keep every export a plain literal: that test reads them without running the file.

export const NEEDLE_VERSION_DIR = "needle-3-93e88ede";

export const NEEDLE_JS_SHA256 = "964681b2a5ec3c4db2f06e45a5b60c8981a7d4ab4cac16ef6bf5b1988657a5f1";
export const NEEDLE_JS_BYTES = 63072;

export const NEEDLE_WASM_SHA256 = "70bdb02b80d062b52cab1597e508b71172a7b355fc448840077a3929170a0733";
export const NEEDLE_WASM_BYTES = 929343;

export const ACCEPTED_WHISTLE_SHAS: readonly string[] = [
  "b6e02f048568ac5d01a2042556c658061e699acbc0aa2a1439f52f3d461dffeb",
];
export const WHISTLE_MODEL_BYTES = 16919407;
