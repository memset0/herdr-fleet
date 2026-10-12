import { describe, expect, it } from "vitest";

import { ACCEPTED_WHISTLE_SHAS, NEEDLE_VERSION_DIR, NEEDLE_WASM_SHA256 } from "./pins";
import type { SttWorkerInbound, SttWorkerReply } from "./protocol";
import {
  TRANSCRIPT_CAPACITY,
  createWorkerCore,
  glueUrl,
  probeModule,
  readTranscript,
  type CreateNeedle,
  type NeedleModule,
  type WorkerHost,
} from "./worker-core";

const MODEL_SHA = ACCEPTED_WHISTLE_SHAS[0] ?? "";

/** The fields a stray message may carry: of the wrong kind, or not in the protocol at all. */
interface StrayMessage {
  type?: string;
  id?: number;
  code?: string;
  wasm?: Uint8Array;
  model?: ArrayBuffer;
  pcm?: number[];
}

/** A message as a structured clone can deliver it: anything at all, not only what the type admits. */
function raw(message: StrayMessage | string | undefined): SttWorkerInbound | null {
  // SAFETY: deliberately false. These tests hand the core the forms its inbound type does not
  // admit, because `MessageEvent.data` is `any` and the core must survive whatever arrives.
  return message as SttWorkerInbound | null;
}

function bytesOfHex(hex: string): ArrayBuffer {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out.buffer;
}

/** A fake engine over a small heap with a bump allocator. `answer` is what a transcribe writes. */
function fakeNeedle(options: { loadRc?: number; answer?: string; tokens?: number; mallocFails?: boolean } = {}) {
  const calls: string[] = [];
  const freed: number[] = [];
  const loadSizes: bigint[] = [];
  let top = 8;
  const engine: NeedleModule & { calls: string[]; freed: number[]; loadSizes: bigint[] } = {
    HEAPU8: new Uint8Array(1 << 17),
    calls,
    freed,
    loadSizes,
    _malloc(size) {
      calls.push(`malloc:${String(size)}`);
      if (options.mallocFails === true) return 0;
      const ptr = top;
      top += size + 8;
      return ptr;
    },
    _free(ptr) {
      freed.push(ptr);
    },
    _needle_load(_ptr, size) {
      loadSizes.push(size);
      return options.loadRc ?? 0;
    },
    _needle_transcribe(_pcm, samples, language, keywords, words, out, capacity) {
      calls.push(`transcribe:${String(samples)}:${String(language)}:${String(keywords)}:${String(words)}:${String(capacity)}`);
      const json = new TextEncoder().encode(options.answer ?? '{"text":" hello there ","language":"en"}');
      engine.HEAPU8.set(json, out);
      engine.HEAPU8[out + json.length] = 0;
      return options.tokens ?? 3;
    },
  };
  return engine;
}

interface Harness {
  host: WorkerHost;
  posts: SttWorkerReply[];
  order: string[];
  setGrowFailed: (value: boolean) => void;
  wasm: ArrayBuffer;
  model: ArrayBuffer;
}

/** A host whose digests are looked up by buffer identity, so a test picks which file "matches". */
function harness(options: {
  compile?: () => Promise<WebAssembly.Module>;
  importGlue?: (url: string) => CreateNeedle | null;
  createNeedle?: CreateNeedle;
  wasmSha?: string;
  modelSha?: string;
  workerUrl?: string;
} = {}): Harness {
  const posts: SttWorkerReply[] = [];
  const order: string[] = [];
  const wasm = new Uint8Array([1, 2, 3]).buffer;
  const model = new Uint8Array([4, 5, 6, 7]).buffer;
  const digests = new Map<ArrayBuffer, string>([
    [wasm, options.wasmSha ?? NEEDLE_WASM_SHA256],
    [model, options.modelSha ?? MODEL_SHA],
  ]);
  let growFailed = false;
  const create: CreateNeedle =
    options.createNeedle ??
    (() => {
      order.push("createNeedle");
      return Promise.resolve(fakeNeedle());
    });
  const host: WorkerHost = {
    compile(bytes) {
      order.push(`compile:${String(bytes.length)}`);
      return options.compile?.() ?? WebAssembly.compile(bytes);
    },
    importGlue(url) {
      order.push(`importGlue:${url}`);
      return options.importGlue ? options.importGlue(url) : create;
    },
    workerUrl: options.workerUrl ?? "https://collie.example/stt/worker-abc.js",
    digest(bytes) {
      order.push(`digest:${bytes === wasm ? "wasm" : bytes === model ? "model" : "other"}`);
      return Promise.resolve(bytesOfHex(digests.get(bytes) ?? "00"));
    },
    post: (reply) => posts.push(reply),
    growFailed: () => growFailed,
    resetGrowFailed: () => {
      growFailed = false;
    },
  };
  return {
    host,
    posts,
    order,
    setGrowFailed: (value) => {
      growFailed = value;
    },
    wasm,
    model,
  };
}

async function booted(h: Harness) {
  const core = createWorkerCore(h.host);
  await core.boot();
  return core;
}

describe("the probe module", () => {
  it("is the eight bytes of an empty module, magic then version 1", () => {
    expect([...probeModule()]).toEqual([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
  });

  it("is a module a real engine accepts", async () => {
    await expect(WebAssembly.compile(probeModule())).resolves.toBeInstanceOf(WebAssembly.Module);
  });
});

describe("glueUrl", () => {
  it("is the pinned version dir beside the worker", () => {
    expect(glueUrl("https://h.example/stt/worker-abc.js")).toBe(
      `https://h.example/stt/${NEEDLE_VERSION_DIR}/needle.js`,
    );
  });

  it("follows the worker under a mount (ADR 0052)", () => {
    expect(glueUrl("https://h.example/collie/stt/worker-abc.js")).toBe(
      `https://h.example/collie/stt/${NEEDLE_VERSION_DIR}/needle.js`,
    );
  });
});

describe("boot", () => {
  it("compiles the probe before it loads the glue, then says ready", async () => {
    const h = harness();
    await booted(h);
    expect(h.order).toEqual(["compile:8", `importGlue:https://collie.example/stt/${NEEDLE_VERSION_DIR}/needle.js`]);
    expect(h.posts).toEqual([{ type: "ready" }]);
  });

  it("fails closed: a refused probe loads no glue and says unsupported", async () => {
    const h = harness({ compile: () => Promise.reject(new Error("CompileError: violates CSP")) });
    await booted(h);
    expect(h.order).toEqual(["compile:8"]);
    expect(h.posts).toEqual([{ type: "unsupported", reason: "wasm-csp" }]);
  });

  it("treats a synchronous throw from compile (no WebAssembly) as the same refusal", async () => {
    const h = harness({
      compile: () => {
        throw new ReferenceError("WebAssembly is not defined");
      },
    });
    await booted(h);
    expect(h.order).toEqual(["compile:8"]);
    expect(h.posts).toEqual([{ type: "unsupported", reason: "wasm-csp" }]);
  });

  it("says glue-failed when the glue does not load or defines nothing", async () => {
    const thrown = harness({
      importGlue: () => {
        throw new Error("NetworkError");
      },
    });
    await booted(thrown);
    expect(thrown.posts).toEqual([{ type: "unsupported", reason: "glue-failed" }]);

    const empty = harness({ importGlue: () => null });
    await booted(empty);
    expect(empty.posts).toEqual([{ type: "unsupported", reason: "glue-failed" }]);
  });

  it("answers a load after a failed boot with load-failed, and compiles nothing", async () => {
    const h = harness({ compile: () => Promise.reject(new Error("csp")) });
    const core = await booted(h);
    core.receive({ type: "load", id: 1, wasm: h.wasm, model: h.model });
    await core.idle();
    expect(h.posts.at(-1)).toEqual({ type: "error", id: 1, code: "load-failed" });
    expect(h.order).not.toContain("createNeedle");
  });
});

describe("load", () => {
  it("hashes the wasm, then the model, before anything compiles, then loads", async () => {
    const engine = fakeNeedle();
    const seen: Uint8Array[] = [];
    const h = harness({
      createNeedle: (options) => {
        h.order.push("createNeedle");
        seen.push(options.wasmBinary);
        return Promise.resolve(engine);
      },
    });
    const core = await booted(h);
    core.receive({ type: "load", id: 7, wasm: h.wasm, model: h.model });
    await core.idle();
    expect(h.order.slice(2)).toEqual(["digest:wasm", "digest:model", "createNeedle"]);
    expect([...(seen[0] ?? [])]).toEqual([1, 2, 3]);
    expect(engine.calls).toEqual(["malloc:4"]);
    // The size crosses as a u64, so a BigInt: `toEqual` tells 4n from 4.
    expect(engine.loadSizes).toEqual([4n]);
    // The model's copy in the heap is freed: needle_load keeps its own.
    expect(engine.freed).toHaveLength(1);
    expect(h.posts.at(-1)).toEqual({ type: "loaded", id: 7 });
  });

  it("refuses a wasm that is not the pinned file, before hashing the model or compiling", async () => {
    const h = harness({ wasmSha: "ab".repeat(32) });
    const core = await booted(h);
    core.receive({ type: "load", id: 2, wasm: h.wasm, model: h.model });
    await core.idle();
    expect(h.order.slice(2)).toEqual(["digest:wasm"]);
    expect(h.posts.at(-1)).toEqual({ type: "error", id: 2, code: "wasm-hash" });
  });

  it("refuses a model that is not on the accepted list, before compiling", async () => {
    const h = harness({ modelSha: "cd".repeat(32) });
    const core = await booted(h);
    core.receive({ type: "load", id: 3, wasm: h.wasm, model: h.model });
    await core.idle();
    expect(h.order.slice(2)).toEqual(["digest:wasm", "digest:model"]);
    expect(h.posts.at(-1)).toEqual({ type: "error", id: 3, code: "model-hash" });
  });

  it("answers load-failed for a non-zero rc, and oom for an empty allocation", async () => {
    const failing = harness({ createNeedle: () => Promise.resolve(fakeNeedle({ loadRc: -1 })) });
    const core = await booted(failing);
    core.receive({ type: "load", id: 4, wasm: failing.wasm, model: failing.model });
    await core.idle();
    expect(failing.posts.at(-1)).toEqual({ type: "error", id: 4, code: "load-failed" });

    const full = harness({ createNeedle: () => Promise.resolve(fakeNeedle({ mallocFails: true })) });
    const fullCore = await booted(full);
    fullCore.receive({ type: "load", id: 5, wasm: full.wasm, model: full.model });
    await fullCore.idle();
    expect(full.posts.at(-1)).toEqual({ type: "error", id: 5, code: "oom" });
  });

  it("maps a RangeError, or an abort after a failed heap growth, to oom", async () => {
    const range = harness({ createNeedle: () => Promise.reject(new RangeError("Array buffer allocation failed")) });
    const rangeCore = await booted(range);
    rangeCore.receive({ type: "load", id: 6, wasm: range.wasm, model: range.model });
    await rangeCore.idle();
    expect(range.posts.at(-1)).toEqual({ type: "error", id: 6, code: "oom" });

    const grown = harness({
      createNeedle: () => {
        grown.setGrowFailed(true);
        return Promise.reject(new WebAssembly.RuntimeError("Aborted(). Build with -sASSERTIONS for more info."));
      },
    });
    const grownCore = await booted(grown);
    grownCore.receive({ type: "load", id: 8, wasm: grown.wasm, model: grown.model });
    await grownCore.idle();
    expect(grown.posts.at(-1)).toEqual({ type: "error", id: 8, code: "oom" });

    const other = harness({ createNeedle: () => Promise.reject(new WebAssembly.RuntimeError("Aborted(bad)")) });
    const otherCore = await booted(other);
    otherCore.receive({ type: "load", id: 9, wasm: other.wasm, model: other.model });
    await otherCore.idle();
    expect(other.posts.at(-1)).toEqual({ type: "error", id: 9, code: "load-failed" });
  });

  it("answers load-failed when hashing itself fails", async () => {
    const h = harness();
    h.host.digest = () => Promise.reject(new Error("no subtle"));
    const core = await booted(h);
    core.receive({ type: "load", id: 10, wasm: h.wasm, model: h.model });
    await core.idle();
    expect(h.posts.at(-1)).toEqual({ type: "error", id: 10, code: "load-failed" });
  });
});

describe("transcribe", () => {
  async function loaded(engine: ReturnType<typeof fakeNeedle>) {
    const h = harness({ createNeedle: () => Promise.resolve(engine) });
    const core = await booted(h);
    core.receive({ type: "load", id: 1, wasm: h.wasm, model: h.model });
    await core.idle();
    return { h, core };
  }

  it("answers not-loaded before a load", async () => {
    const h = harness();
    const core = await booted(h);
    core.receive({ type: "transcribe", id: 1, pcm: new Float32Array(16) });
    await core.idle();
    expect(h.posts.at(-1)).toEqual({ type: "error", id: 1, code: "not-loaded" });
  });

  it("runs the engine with no language, keywords or word times, and frees both buffers", async () => {
    const engine = fakeNeedle();
    const { h, core } = await loaded(engine);
    const freedBefore = engine.freed.length;
    core.receive({ type: "transcribe", id: 2, pcm: new Float32Array(1600) });
    await core.idle();
    expect(engine.calls).toContain(`transcribe:1600:0:0:0:${String(TRANSCRIPT_CAPACITY)}`);
    expect(engine.freed.length - freedBefore).toBe(2);
    expect(h.posts.at(-1)).toEqual({ type: "result", id: 2, text: "hello there", language: "en" });
  });

  it("answers an empty clip without running the engine", async () => {
    const engine = fakeNeedle();
    const { h, core } = await loaded(engine);
    core.receive({ type: "transcribe", id: 3, pcm: new Float32Array(0) });
    await core.idle();
    expect(engine.calls.some((call) => call.startsWith("transcribe"))).toBe(false);
    expect(h.posts.at(-1)).toEqual({ type: "result", id: 3, text: "", language: "" });
  });

  it("answers transcribe-failed for a negative count or an answer that is not the JSON shape", async () => {
    const negative = await loaded(fakeNeedle({ tokens: -2 }));
    negative.core.receive({ type: "transcribe", id: 4, pcm: new Float32Array(8) });
    await negative.core.idle();
    expect(negative.h.posts.at(-1)).toEqual({ type: "error", id: 4, code: "transcribe-failed" });

    const garbage = await loaded(fakeNeedle({ answer: "not json" }));
    garbage.core.receive({ type: "transcribe", id: 5, pcm: new Float32Array(8) });
    await garbage.core.idle();
    expect(garbage.h.posts.at(-1)).toEqual({ type: "error", id: 5, code: "transcribe-failed" });
  });

  it("maps an abort after a failed growth to oom, and drops the dead engine", async () => {
    const engine = fakeNeedle();
    const { h, core } = await loaded(engine);
    engine._needle_transcribe = () => {
      h.setGrowFailed(true);
      throw new WebAssembly.RuntimeError("Aborted()");
    };
    core.receive({ type: "transcribe", id: 6, pcm: new Float32Array(8) });
    await core.idle();
    expect(h.posts.at(-1)).toEqual({ type: "error", id: 6, code: "oom" });
    core.receive({ type: "transcribe", id: 7, pcm: new Float32Array(8) });
    await core.idle();
    expect(h.posts.at(-1)).toEqual({ type: "error", id: 7, code: "not-loaded" });
  });

  it("handles a transcribe sent before the load finished after the load", async () => {
    const h = harness();
    const core = createWorkerCore(h.host);
    void core.boot();
    core.receive({ type: "load", id: 1, wasm: h.wasm, model: h.model });
    core.receive({ type: "transcribe", id: 2, pcm: new Float32Array(8) });
    await core.idle();
    expect(h.posts.map((post) => post.type)).toEqual(["ready", "loaded", "result"]);
  });
});

describe("messages", () => {
  it("ignores an unknown type and a message without a usable id", async () => {
    const h = harness();
    const core = await booted(h);
    core.receive(raw({ type: "eval", id: 1, code: "x" }));
    core.receive({ type: "load", wasm: h.wasm, model: h.model });
    core.receive({ type: "transcribe", id: 1.5, pcm: new Float32Array(1) });
    core.receive(null);
    core.receive(raw(undefined));
    core.receive(raw("load"));
    await core.idle();
    expect(h.posts).toEqual([{ type: "ready" }]);
  });

  it("answers bad-request for a known type with the wrong fields", async () => {
    const h = harness();
    const core = await booted(h);
    core.receive(raw({ type: "load", id: 1, wasm: new Uint8Array(3), model: h.model }));
    core.receive(raw({ type: "transcribe", id: 2, pcm: [0, 0] }));
    await core.idle();
    expect(h.posts.slice(1)).toEqual([
      { type: "error", id: 1, code: "bad-request" },
      { type: "error", id: 2, code: "bad-request" },
    ]);
  });
});

describe("readTranscript", () => {
  const encode = (text: string) => {
    const heap = new Uint8Array(64);
    heap.set(new TextEncoder().encode(text), 4);
    return heap;
  };

  it("reads up to the first zero inside the capacity", () => {
    expect(readTranscript(encode('{"text":"hi","language":"de"}'), 4, 60)).toEqual({ text: "hi", language: "de" });
  });

  it("is null without a terminator inside the capacity", () => {
    expect(readTranscript(encode('{"text":"hi"}'), 4, 5)).toBeNull();
  });

  it("is null for JSON without a text string, and defaults a missing language", () => {
    expect(readTranscript(encode('{"txt":"hi"}'), 4, 60)).toBeNull();
    expect(readTranscript(encode('{"text":"hi"}'), 4, 60)).toEqual({ text: "hi", language: "" });
  });
});
