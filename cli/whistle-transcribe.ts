import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { compileFunction } from "node:vm";

import { resolveStateDir } from "../bridge/config.ts";
import type { JsonValue } from "../bridge/json.ts";
import { pluginRoot } from "../bridge/root.ts";
import { jsonRecord, jsonStringField } from "../bridge/stt/json.ts";
import { decodeWav16 } from "../bridge/stt/wav.ts";
import { whistleEngineDir, whistlePaths } from "../bridge/stt/whistle-model.ts";
import { ACCEPTED_WHISTLE_SHAS, NEEDLE_JS_SHA256, NEEDLE_WASM_SHA256 } from "../bridge/stt/whistle-pins.ts";
import { EXIT, type Io } from "./io.ts";

// `collie _whistle-transcribe <wav>` — the host engine's child (ADR 0096 Decision 4).
//
// Spelled only by the bridge's `whistle` provider (bridge/stt/whistle.ts), never by a person, so it
// is not in the usage line. One run is one transcription:
//
//   1. Read the vendored engine (`needle.js`, `needle.wasm`) from the served `web/dist/stt/<v>/`, or,
//      in a source checkout with no web build, from `web/public/stt/<v>/`, the folder Vite copies
//      byte for byte (`whistleEngineDir`). Read the model from `<stateDir>/whistle/`.
//   2. Check all three against the pins compiled into this binary, BEFORE anything is compiled. The
//      glue is then run from the bytes that were checked, not read from disk a second time.
//   3. Read the WAV (the bridge already checked its header; it is checked again here, because this
//      verb trusts nothing it did not read itself) and turn its 16-bit samples into floats.
//   4. Load, transcribe, and print the `text` field, trimmed, on stdout. Nothing else goes there:
//      the glue's own `print` is sent to stderr, which the bridge never reads.
//
// Any failure is one short line on stderr and a non-zero exit. The verb reads no network: the glue
// would fetch the wasm only when it is not handed one, and it always is. Of the environment it
// reads `COLLIE_STATE_DIR` and `COLLIE_PLUGIN_ROOT` only, through the resolvers the rest of Collie
// uses; the bridge sets both to the values it resolved (see bridge/stt/whistle.ts).

/** Room for the engine's JSON answer. A four-minute clip's text is a few kilobytes. */
const OUTPUT_CAPACITY = 64 * 1024;

/** The few members of the Emscripten module this verb calls. */
export interface NeedleModule {
  HEAPU8: Uint8Array;
  _malloc(bytes: number): number;
  _free(pointer: number): void;
  _needle_load(pointer: number, bytes: bigint): number;
  _needle_transcribe(pcm: number, samples: number, a: number, b: number, c: number, out: number, capacity: number): number;
}

/** The CommonJS `module` the glue assigns its factory to. */
interface GlueModule {
  exports: object;
}

export type CreateNeedle = (options: { wasmBinary: Uint8Array; print: (text: string) => void; printErr: (text: string) => void }) => Promise<NeedleModule>;

export interface WhistleTranscribeDeps {
  io: Io;
  env: Record<string, string | undefined>;
  /** The checkout root. {@link pluginRoot} unless a test names one. */
  root?: string;
}

/** A failure with the one line that will be printed. */
class Refusal extends Error {}

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

function readChecked(path: string, expected: readonly string[], what: string): Uint8Array {
  let bytes: Uint8Array;
  try {
    // A symlink is refused for the model, as the bridge refuses it (whistle-model.ts).
    if (lstatSync(path).isSymbolicLink()) throw new Refusal(`the ${what} is a symlink; it is not followed`);
    bytes = readFileSync(path);
  } catch (err) {
    if (err instanceof Refusal) throw err;
    throw new Refusal(`the ${what} cannot be read`);
  }
  if (!expected.includes(sha256(bytes))) throw new Refusal(`the ${what} does not match its pin`);
  return bytes;
}

/**
 * Run the glue from the checked bytes, as CommonJS would run the file: it is a UMD script that ends
 * in `module.exports = createNeedle`. `require` is a real one rooted at the engine folder, for the
 * two builtins the glue asks for under Node (`node:fs`, `node:crypto`).
 */
function loadGlue(source: Uint8Array, dir: string): CreateNeedle {
  const filename = join(dir, "needle.js");
  const run = compileFunction(new TextDecoder().decode(source), ["exports", "require", "module", "__filename", "__dirname"], { filename });
  const module: GlueModule = { exports: {} };
  run(module.exports, createRequire(filename), module, filename, dir);
  // SAFETY: these are the bytes whose sha256 matched NEEDLE_JS_SHA256, and that pinned file ends in
  // `module.exports = createNeedle`, the factory whose call sequence this module is written against.
  // Were it anything else, the call below throws and the verb answers "the engine stopped".
  return module.exports as CreateNeedle;
}

/**
 * The engine's answer in the output buffer: the bytes up to its terminating zero, searched for
 * inside the buffer only (`web/src/stt/worker-core.ts` `readTranscript` reads it the same way). No
 * zero inside it is a refusal, never a read past the end into the rest of the heap.
 */
export function readAnswer(heap: Uint8Array, at: number, capacity: number): string {
  const window = heap.subarray(at, at + capacity);
  const end = window.indexOf(0);
  if (end === -1) throw new Refusal("the engine's answer did not end inside its buffer");
  return new TextDecoder().decode(window.subarray(0, end));
}

/** The transcript of `pcm`, 16 kHz mono floats. Exported for the test, which hands it a fake engine. */
export async function transcribe(createNeedle: CreateNeedle, wasm: Uint8Array, model: Uint8Array, pcm: Float32Array, io: Io): Promise<string> {
  const quiet = (text: string): void => io.err(text);
  const engine = await createNeedle({ wasmBinary: wasm, print: quiet, printErr: quiet });
  const modelAt = engine._malloc(model.byteLength);
  engine.HEAPU8.set(model, modelAt);
  const loaded = engine._needle_load(modelAt, BigInt(model.byteLength));
  if (loaded !== 0) throw new Refusal(`the engine could not load the model (code ${loaded})`);

  const pcmAt = engine._malloc(pcm.byteLength);
  engine.HEAPU8.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), pcmAt);
  const outAt = engine._malloc(OUTPUT_CAPACITY);
  // Zeroed first: `malloc` hands back whatever the heap held there, and an answer the engine did not
  // terminate must not run on into old bytes.
  engine.HEAPU8.fill(0, outAt, outAt + OUTPUT_CAPACITY);
  const written = engine._needle_transcribe(pcmAt, pcm.length, 0, 0, 0, outAt, OUTPUT_CAPACITY);
  if (written < 0) throw new Refusal(`the engine could not transcribe (code ${written})`);
  // HEAPU8 is read after the call: a heap that grew during it is a new buffer.
  const answer = readAnswer(engine.HEAPU8, outAt, OUTPUT_CAPACITY);
  engine._free(pcmAt);
  engine._free(outAt);

  let parsed: JsonValue;
  try {
    // SAFETY: `JSON.parse` answers with a JSON value; the one field read is narrowed below.
    parsed = JSON.parse(answer) as JsonValue;
  } catch {
    throw new Refusal("the engine's answer was not JSON");
  }
  const text = jsonStringField(jsonRecord(parsed)?.text);
  if (text === null) throw new Refusal("the engine's answer had no text");
  return text.trim();
}

export async function cmdWhistleTranscribe(args: readonly string[], deps: WhistleTranscribeDeps): Promise<number> {
  if (args.length !== 1) {
    deps.io.err("error: `collie _whistle-transcribe` takes one WAV path; it is run by the bridge");
    return EXIT.USAGE;
  }
  try {
    const dir = whistleEngineDir(deps.root ?? pluginRoot());
    const glue = readChecked(join(dir, "needle.js"), [NEEDLE_JS_SHA256], "engine glue");
    const wasm = readChecked(join(dir, "needle.wasm"), [NEEDLE_WASM_SHA256], "engine wasm");
    const model = readChecked(whistlePaths(resolveStateDir(deps.env)).model, ACCEPTED_WHISTLE_SHAS, "Whistle model");

    let pcm: Float32Array;
    try {
      pcm = decodeWav16(readFileSync(args[0]!));
    } catch {
      throw new Refusal("the recording is not a 16 kHz mono 16-bit WAV");
    }
    const text = await transcribe(loadGlue(glue, dir), wasm, model, pcm, deps.io);
    deps.io.out(text);
    return EXIT.OK;
  } catch (err) {
    deps.io.err(`error: ${err instanceof Refusal ? err.message : "the engine stopped"}`);
    return EXIT.FAIL;
  }
}
