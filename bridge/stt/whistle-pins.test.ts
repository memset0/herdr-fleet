import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  ACCEPTED_WHISTLE_SHAS,
  NEEDLE_JS_BYTES,
  NEEDLE_JS_SHA256,
  NEEDLE_VERSION_DIR,
  NEEDLE_WASM_BYTES,
  NEEDLE_WASM_SHA256,
  WASM_IMPORTS,
  WHISTLE_MODEL,
} from "./whistle-pins.ts";

// ADR 0096 Decision 6: the vendored engine is pinned, and the wasm import list (everything the
// engine can ask its host to do) is pinned with it. These tests fail when a vendored byte moves,
// when the import list grows, or when the phone's mirror of the pins drifts from the bridge's.

const REPO = join(import.meta.dir, "..", "..");
const ENGINE_DIR = join(REPO, "web", "public", "stt", NEEDLE_VERSION_DIR);
const WEB_PINS = join(REPO, "web", "src", "stt", "pins.ts");

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const readBytes = (name: string): Uint8Array => new Uint8Array(readFileSync(join(ENGINE_DIR, name)));

/** The sha256 of upstream's needle3 LICENSE (the Apache-2.0 text) at the pinned commit. */
const LICENSE_SHA256 = "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30";
const LICENSE_BYTES = 11358;

/**
 * Read the import section of a wasm module: [module, name] for each import. A hand-written reader
 * on purpose, so the guard needs no dependency and no engine to run. It throws on anything it does
 * not understand, which is the safe direction for a guard.
 */
function readWasmImports(bytes: Uint8Array): { module: string; name: string }[] {
  let at = 0;
  const byte = (): number => {
    const value = bytes[at];
    if (value === undefined) throw new Error("wasm ends early");
    at += 1;
    return value;
  };
  const u32 = (): number => {
    let result = 0;
    for (let shift = 0; shift < 35; shift += 7) {
      const next = byte();
      result += (next & 0x7f) * 2 ** shift;
      if ((next & 0x80) === 0) return result;
    }
    throw new Error("bad LEB128");
  };
  const text = (): string => {
    const length = u32();
    const out = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(at, at + length));
    at += length;
    return out;
  };
  const limits = (): void => {
    const flags = u32();
    u32();
    if ((flags & 1) !== 0) u32();
  };

  if (bytes.length < 8 || [0, 0x61, 0x73, 0x6d].some((magic, i) => bytes[i] !== magic)) {
    throw new Error("not a wasm module");
  }
  at = 8;
  const found: { module: string; name: string }[] = [];
  while (at < bytes.length) {
    const sectionId = byte();
    const size = u32();
    const end = at + size;
    if (sectionId !== 2) {
      at = end;
      continue;
    }
    const count = u32();
    for (let i = 0; i < count; i += 1) {
      const module = text();
      const name = text();
      found.push({ module, name });
      const kind = byte();
      if (kind === 0) u32(); // function: type index
      else if (kind === 1) {
        byte(); // table: element type
        limits();
      } else if (kind === 2) limits(); // memory
      else if (kind === 3) at += 2; // global: value type, mutability
      else if (kind === 4) {
        byte(); // tag: attribute
        u32();
      } else throw new Error(`unknown import kind ${kind}`);
    }
    if (at !== end) throw new Error("import section length mismatch");
    return found;
  }
  throw new Error("no import section");
}

/** `export const NAME = <literal>;` values of the phone's mirror, read as text. */
function readWebPins(): Map<string, string> {
  const source = readFileSync(WEB_PINS, "utf8");
  const values = new Map<string, string>();
  for (const match of source.matchAll(/^export const (\w+)(?::[^=]+)? = ([^;]+);$/gm)) {
    const [, name, literal] = match;
    if (name !== undefined && literal !== undefined) values.set(name, literal.trim());
  }
  return values;
}

describe("vendored needle engine", () => {
  test("needle.js and needle.wasm are the pinned bytes", () => {
    const js = readBytes("needle.js");
    const wasm = readBytes("needle.wasm");
    expect(js.byteLength).toBe(NEEDLE_JS_BYTES);
    expect(sha256(js)).toBe(NEEDLE_JS_SHA256);
    expect(wasm.byteLength).toBe(NEEDLE_WASM_BYTES);
    expect(sha256(wasm)).toBe(NEEDLE_WASM_SHA256);
  });

  test("the LICENSE is upstream's Apache-2.0 text", () => {
    const license = readBytes("LICENSE");
    expect(license.byteLength).toBe(LICENSE_BYTES);
    expect(sha256(license)).toBe(LICENSE_SHA256);
    expect(new TextDecoder().decode(license)).toContain("Apache License");
  });

  test("PROVENANCE.md records the same hashes and sizes", () => {
    const provenance = readFileSync(join(ENGINE_DIR, "PROVENANCE.md"), "utf8");
    expect(provenance).toContain(`\`${NEEDLE_JS_SHA256}\``);
    expect(provenance).toContain(`\`${NEEDLE_WASM_SHA256}\``);
    expect(provenance).toContain(`\`${LICENSE_SHA256}\``);
    expect(provenance).toContain(`| \`needle.js\` | ${NEEDLE_JS_BYTES} |`);
    expect(provenance).toContain(`| \`needle.wasm\` | ${NEEDLE_WASM_BYTES} |`);
    expect(provenance).toContain(`| \`LICENSE\` | ${LICENSE_BYTES} |`);
  });

  test("the wasm asks its host for exactly the pinned imports", () => {
    expect(readWasmImports(readBytes("needle.wasm"))).toEqual(
      WASM_IMPORTS.map(({ module, name }) => ({ module, name })),
    );
  });

  test("the glue maps those imports to the system calls the ADR reviewed", () => {
    const glue = new TextDecoder().decode(readBytes("needle.js"));
    expect(glue).toContain(
      "wasmImports={a:___cxa_throw,d:___syscall_fcntl64,i:___syscall_ioctl,p:___syscall_openat," +
        "n:___syscall_rmdir,o:___syscall_unlinkat,e:__abort_js,f:__munmap_js,l:_clock_time_get," +
        "m:_emscripten_resize_heap,j:_environ_get,k:_environ_sizes_get,b:_fd_close,h:_fd_read," +
        "g:_fd_seek,c:_fd_write}",
    );
  });

  test("the reader itself rejects what it cannot read", () => {
    expect(() => readWasmImports(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow("not a wasm");
    expect(() => readWasmImports(new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]))).toThrow("no import");
  });
});

describe("the phone's pins mirror the bridge's", () => {
  test("every mirrored value equals the bridge value", () => {
    const web = readWebPins();
    expect(web.get("NEEDLE_VERSION_DIR")).toBe(JSON.stringify(NEEDLE_VERSION_DIR));
    expect(web.get("NEEDLE_JS_SHA256")).toBe(JSON.stringify(NEEDLE_JS_SHA256));
    expect(web.get("NEEDLE_JS_BYTES")).toBe(String(NEEDLE_JS_BYTES));
    expect(web.get("NEEDLE_WASM_SHA256")).toBe(JSON.stringify(NEEDLE_WASM_SHA256));
    expect(web.get("NEEDLE_WASM_BYTES")).toBe(String(NEEDLE_WASM_BYTES));
    expect(web.get("WHISTLE_MODEL_BYTES")).toBe(String(WHISTLE_MODEL.bytes));
  });

  test("the accepted model hashes are the same list", () => {
    const literal = readWebPins().get("ACCEPTED_WHISTLE_SHAS");
    if (literal === undefined) throw new Error("web pins do not export ACCEPTED_WHISTLE_SHAS");
    const parsed: unknown = JSON.parse(literal.replace(/,\s*]$/, "]"));
    expect(parsed).toEqual([...ACCEPTED_WHISTLE_SHAS]);
  });
});
