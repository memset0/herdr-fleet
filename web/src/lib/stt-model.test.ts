import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchSttModel } from "@/lib/api";
import type { WhistleStatus } from "@/lib/types";
import { server } from "@/test/setup";
import { ACCEPTED_WHISTLE_SHAS, NEEDLE_VERSION_DIR } from "@/stt/pins";
import { sttCacheName, sttEnginePath, sttModelPath } from "./stt-cache";
import {
  __resetSttModel,
  downloadModel,
  getEngineBytes,
  hasModel,
  removeModel,
  storedModel,
  subscribeStoredModel,
  SttModelError,
  type SttModelDeps,
} from "./stt-model";

// The engine files are the real vendored pair, so their pins are checked for real. The model is a
// few bytes standing in for 17 MB: the fake digest answers the accepted hash for exactly those bytes.

const SHA = ACCEPTED_WHISTLE_SHAS[0] ?? "";
const MODEL = new TextEncoder().encode("a pretend model, a few bytes long");
const PUBLIC = resolve(import.meta.dirname, "../../public/stt", NEEDLE_VERSION_DIR);
const JS = new Uint8Array(readFileSync(resolve(PUBLIC, "needle.js")));
const WASM = new Uint8Array(readFileSync(resolve(PUBLIC, "needle.wasm")));
const ORIGIN = "https://phone.example";

function urlOf(key: string | Request): string {
  return key instanceof Request ? key.url : key;
}

class FakeCache {
  entries = new Map<string, Response>();
  putError: Error | null = null;
  async put(key: string | Request, response: Response): Promise<void> {
    if (this.putError !== null) throw this.putError;
    this.entries.set(urlOf(key), response);
  }
  async match(key: string | Request): Promise<Response | undefined> {
    const found = this.entries.get(urlOf(key));
    return found?.clone();
  }
  async keys(): Promise<Request[]> {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
  async delete(key: string | Request): Promise<boolean> {
    return this.entries.delete(urlOf(key));
  }
}

class FakeStorage {
  caches = new Map<string, FakeCache>();
  opened: string[] = [];
  async has(name: string): Promise<boolean> {
    return this.caches.has(name);
  }
  async open(name: string): Promise<FakeCache> {
    this.opened.push(name);
    let cache = this.caches.get(name);
    if (cache === undefined) {
      cache = new FakeCache();
      this.caches.set(name, cache);
    }
    return cache;
  }
  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name);
  }
}

function fromHex(text: string): ArrayBuffer {
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out.buffer;
}

function viewOf(bytes: BufferSource): Uint8Array {
  return ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : new Uint8Array(bytes);
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  return a.byteLength === b.byteLength && a.every((v, i) => v === b[i]);
}

/** A body of `chunks`, streamed. */
function streamed(chunks: Uint8Array[], init: ResponseInit = {}): Response {
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = chunks[i++];
      if (next === undefined) controller.close();
      else controller.enqueue(next);
    },
  });
  return new Response(body, { status: 200, ...init });
}

function chunked(bytes: Uint8Array, size: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let at = 0; at < bytes.length; at += size) out.push(bytes.slice(at, at + size));
  return out;
}

const READY: WhistleStatus = {
  state: "ready",
  bytes: MODEL.byteLength,
  sha256: SHA,
  hostEngine: false,
  hostTaken: false,
};

interface Harness {
  storage: FakeStorage;
  deps: SttModelDeps;
  digest: ReturnType<typeof vi.fn>;
  /** The byte length of everything hashed, in order. */
  hashed: number[];
  fetchModel: ReturnType<typeof vi.fn>;
  fetchEngineFile: ReturnType<typeof vi.fn>;
  persist: ReturnType<typeof vi.fn>;
}

function harness(overrides: Partial<SttModelDeps> = {}, mount = "/"): Harness {
  const storage = new FakeStorage();
  const hashed: number[] = [];
  const digest = vi.fn(async (bytes: BufferSource) => {
    const view = viewOf(bytes);
    hashed.push(view.byteLength);
    if (equal(view, MODEL)) return fromHex(SHA);
    return crypto.subtle.digest("SHA-256", bytes);
  });
  const fetchModel = vi.fn(async () => streamed(chunked(MODEL, 8)));
  const fetchEngineFile = vi.fn(async (file: string) => new Response(file === "needle.js" ? JS : WASM, { status: 200 }));
  const persist = vi.fn(async () => true);
  const deps: SttModelDeps = {
    caches: storage,
    mount: () => mount,
    origin: () => ORIGIN,
    fetchModel,
    fetchEngineFile,
    digest,
    estimate: async () => ({ quota: 10_000_000_000, usage: 0 }),
    persist,
    persisted: async () => true,
    ...overrides,
  };
  return { storage, deps, digest, hashed, fetchModel, fetchEngineFile, persist };
}

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof SttModelError) return error.code;
    throw error;
  }
  return "no error";
}

beforeEach(() => __resetSttModel());
afterEach(() => vi.restoreAllMocks());

describe("downloadModel", () => {
  it("streams with progress, checks both hashes, stores the model and the engine, and asks to persist", async () => {
    const h = harness();
    const progress: [number, number][] = [];
    const result = await downloadModel(READY, (received, total) => progress.push([received, total]), undefined, h.deps);

    expect(result).toEqual({ sha256: SHA, bytes: MODEL.byteLength, persisted: true });
    expect(progress[0]).toEqual([0, MODEL.byteLength]);
    expect(progress.at(-1)).toEqual([MODEL.byteLength, MODEL.byteLength]);
    const received = progress.map(([bytes]) => bytes);
    expect(received).toEqual(received.toSorted((a, b) => a - b));

    const cache = h.storage.caches.get("collie-stt");
    expect([...(cache?.entries.keys() ?? [])].toSorted()).toEqual(
      [
        `${ORIGIN}${sttModelPath(SHA)}`,
        `${ORIGIN}${sttEnginePath("needle.js")}`,
        `${ORIGIN}${sttEnginePath("needle.wasm")}`,
      ].toSorted(),
    );
    expect(h.persist).toHaveBeenCalledTimes(1);
    expect(await storedModel(h.deps)).toEqual({ sha256: SHA, bytes: MODEL.byteLength });
  });

  it("stores a fresh 200 built from the verified bytes, not the response that carried them", async () => {
    const h = harness({
      fetchModel: vi.fn(async () => streamed(chunked(MODEL, 8), { headers: { "set-cookie": "x=1", "x-evil": "1" } })),
    });
    await downloadModel(READY, () => {}, undefined, h.deps);
    const stored = await h.storage.caches.get("collie-stt")?.match(`${ORIGIN}${sttModelPath(SHA)}`);
    expect(stored?.status).toBe(200);
    expect(stored?.redirected).toBe(false);
    expect(stored?.headers.get("content-type")).toBe("application/octet-stream");
    expect(stored?.headers.get("x-evil")).toBeNull();
    expect([...new Uint8Array(await (stored?.arrayBuffer() ?? Promise.resolve(new ArrayBuffer(0))))]).toEqual([...MODEL]);
  });

  it("names the cache and the keys under a mount", async () => {
    const h = harness({}, "/collie/");
    await downloadModel(READY, () => {}, undefined, h.deps);
    const cache = h.storage.caches.get(sttCacheName("/collie/"));
    expect([...(cache?.entries.keys() ?? [])]).toContain(`${ORIGIN}/collie${sttModelPath(SHA)}`);
    expect(await hasModel(h.deps)).toBe(true);
  });

  it("refuses a host that is not ready, or whose hash this build does not accept, before fetching anything", async () => {
    const h = harness();
    expect(await code(downloadModel({ ...READY, state: "downloading" }, () => {}, undefined, h.deps))).toBe("unknown-model");
    expect(await code(downloadModel({ ...READY, sha256: "b".repeat(64) }, () => {}, undefined, h.deps))).toBe("unknown-model");
    expect(await code(downloadModel({ ...READY, sha256: undefined }, () => {}, undefined, h.deps))).toBe("unknown-model");
    expect(h.fetchModel).not.toHaveBeenCalled();
    expect(h.fetchEngineFile).not.toHaveBeenCalled();
  });

  it("refuses when free space is under twice the model, with nothing fetched", async () => {
    const h = harness({ estimate: async () => ({ quota: 1000, usage: 1000 - MODEL.byteLength * 2 + 1 }) });
    expect(await code(downloadModel(READY, () => {}, undefined, h.deps))).toBe("low-space");
    expect(h.fetchModel).not.toHaveBeenCalled();
    expect(h.storage.caches.size).toBe(0);
  });

  it("goes ahead at exactly twice the size, and when the browser cannot estimate", async () => {
    const exactly = harness({ estimate: async () => ({ quota: MODEL.byteLength * 2, usage: 0 }) });
    await downloadModel(READY, () => {}, undefined, exactly.deps);
    const unknown = harness({ estimate: async () => null });
    await downloadModel(READY, () => {}, undefined, unknown.deps);
    expect(await hasModel(unknown.deps)).toBe(true);
  });

  it("keeps nothing when the bytes do not hash to the host's hash", async () => {
    const h = harness({ fetchModel: vi.fn(async () => streamed(chunked(new TextEncoder().encode("a pretend model, a few bytes lonn"), 8))) });
    expect(await code(downloadModel(READY, () => {}, undefined, h.deps))).toBe("hash-mismatch");
    expect(h.storage.caches.get("collie-stt")).toBeUndefined();
  });

  it("refuses a body longer than the host said, and one that ends short", async () => {
    const longer = harness({ fetchModel: vi.fn(async () => streamed(chunked(new Uint8Array(MODEL.byteLength + 20), 8))) });
    expect(await code(downloadModel(READY, () => {}, undefined, longer.deps))).toBe("hash-mismatch");
    const shorter = harness({ fetchModel: vi.fn(async () => streamed(chunked(MODEL.slice(0, 10), 8))) });
    expect(await code(downloadModel(READY, () => {}, undefined, shorter.deps))).toBe("download-failed");
    expect(longer.storage.caches.get("collie-stt")).toBeUndefined();
    expect(shorter.storage.caches.get("collie-stt")).toBeUndefined();
  });

  it("refuses a redirected or non-200 answer", async () => {
    const redirected = new Response(MODEL, { status: 200 });
    Object.defineProperty(redirected, "redirected", { value: true });
    const a = harness({ fetchModel: vi.fn(async () => redirected) });
    expect(await code(downloadModel(READY, () => {}, undefined, a.deps))).toBe("download-failed");
    const b = harness({ fetchModel: vi.fn(async () => new Response("no", { status: 206 })) });
    expect(await code(downloadModel(READY, () => {}, undefined, b.deps))).toBe("download-failed");
    expect(a.storage.caches.size + b.storage.caches.size).toBe(0);
  });

  it("reports a host refusal as download-failed and keeps the thrown value as the cause", async () => {
    const refusal = new Error("stt.model_unknown");
    const h = harness({ fetchModel: vi.fn(async () => Promise.reject(refusal)) });
    try {
      await downloadModel(READY, () => {}, undefined, h.deps);
      expect.unreachable("the download should have failed");
    } catch (caught) {
      expect(caught).toBeInstanceOf(SttModelError);
      expect(caught).toMatchObject({ code: "download-failed", cause: refusal });
    }
  });

  it("calls a busy host retryable: 503 stt.model_busy is `busy`, not a broken copy, and stores nothing", async () => {
    server.use(
      http.get(`/api/stt/model/${SHA}`, () =>
        HttpResponse.json({ error: "busy", code: "stt.model_busy" }, { status: 503, headers: { "retry-after": "5" } }),
      ),
    );
    const h = harness({ fetchModel: fetchSttModel });
    expect(await code(downloadModel(READY, () => {}, undefined, h.deps))).toBe("busy");
    expect(h.storage.caches.size).toBe(0);
  });

  it("keeps any other 503 as a plain failed copy", async () => {
    server.use(http.get(`/api/stt/model/${SHA}`, () => new HttpResponse("down", { status: 503 })));
    const h = harness({ fetchModel: fetchSttModel });
    expect(await code(downloadModel(READY, () => {}, undefined, h.deps))).toBe("download-failed");
  });

  it("reports a caller's abort as aborted, and stores nothing", async () => {
    const controller = new AbortController();
    const h = harness({
      fetchModel: vi.fn(async () => {
        controller.abort();
        throw new DOMException("aborted", "AbortError");
      }),
    });
    expect(await code(downloadModel(READY, () => {}, controller.signal, h.deps))).toBe("aborted");
    expect(h.storage.caches.size).toBe(0);
  });

  it("refuses an engine file that is not the pinned one, before it spends the model's 17 MB", async () => {
    const h = harness({ fetchEngineFile: vi.fn(async () => new Response(new Uint8Array(WASM.length), { status: 200 })) });
    expect(await code(downloadModel(READY, () => {}, undefined, h.deps))).toBe("engine-mismatch");
    expect(h.fetchModel).not.toHaveBeenCalled();
    expect(h.storage.caches.size).toBe(0);
  });

  it("deletes the model entry when the browser refuses to store the rest", async () => {
    const h = harness();
    const original = h.storage.open.bind(h.storage);
    h.storage.open = async (name: string) => {
      const cache = await original(name);
      let writes = 0;
      const put = cache.put.bind(cache);
      cache.put = async (key, response) => {
        writes += 1;
        if (writes === 2) throw new DOMException("quota", "QuotaExceededError");
        await put(key, response);
      };
      return cache;
    };
    expect(await code(downloadModel(READY, () => {}, undefined, h.deps))).toBe("storage-failed");
    expect(h.storage.caches.get("collie-stt")?.entries.has(`${ORIGIN}${sttModelPath(SHA)}`)).toBe(false);
  });

  it("replaces an older model rather than keeping two", async () => {
    const h = harness();
    const old = "d".repeat(64);
    const cache = await h.storage.open("collie-stt");
    cache.entries.set(`${ORIGIN}${sttModelPath(old)}`, new Response("old"));
    await downloadModel(READY, () => {}, undefined, h.deps);
    expect(cache.entries.has(`${ORIGIN}${sttModelPath(old)}`)).toBe(false);
    expect(cache.entries.has(`${ORIGIN}${sttModelPath(SHA)}`)).toBe(true);
  });

  it("refuses at once where there is no Cache Storage", async () => {
    const h = harness({ caches: undefined });
    expect(await code(downloadModel(READY, () => {}, undefined, h.deps))).toBe("unsupported");
    expect(h.fetchModel).not.toHaveBeenCalled();
  });

  it("tells subscribers when the stored model changes", async () => {
    const h = harness();
    const seen = vi.fn();
    const stop = subscribeStoredModel(seen);
    await downloadModel(READY, () => {}, undefined, h.deps);
    expect(seen).toHaveBeenCalledTimes(1);
    await removeModel(h.deps);
    expect(seen).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe("the revision kept beside the copy", () => {
  const REVISION = "ca5287601bef25af26dcf2e1b2bdc0843a7c19e5";

  it("records the host's revision with the copy, and reads it back", async () => {
    const h = harness();
    const result = await downloadModel({ ...READY, revision: REVISION }, () => {}, undefined, h.deps);
    expect(result).toEqual({ sha256: SHA, bytes: MODEL.byteLength, revision: REVISION, persisted: true });
    expect(await storedModel(h.deps)).toEqual({ sha256: SHA, bytes: MODEL.byteLength, revision: REVISION });
  });

  it("keeps working for a host that names no revision: the copy has none either", async () => {
    const h = harness();
    await downloadModel(READY, () => {}, undefined, h.deps);
    expect(await storedModel(h.deps)).not.toHaveProperty("revision");
  });

  it("does not record a revision that is not a plain name", async () => {
    const h = harness();
    await downloadModel({ ...READY, revision: "../../x y" }, () => {}, undefined, h.deps);
    expect(await storedModel(h.deps)).not.toHaveProperty("revision");
  });

  it("reads a copy stored before the revision was recorded as a copy with no revision", async () => {
    const h = harness();
    const cache = await h.storage.open("collie-stt");
    cache.entries.set(
      `${ORIGIN}${sttModelPath(SHA)}`,
      new Response(MODEL, { headers: { "content-type": "application/octet-stream", "content-length": String(MODEL.byteLength) } }),
    );
    expect(await storedModel(h.deps)).toEqual({ sha256: SHA, bytes: MODEL.byteLength });
  });
});

describe("storedModel and hasModel", () => {
  it("read without creating a cache for a phone that never downloaded", async () => {
    const h = harness();
    expect(await storedModel(h.deps)).toBeNull();
    expect(await hasModel(h.deps)).toBe(false);
    expect(h.storage.opened).toEqual([]);
  });

  it("ignore a model hash this build does not accept", async () => {
    const h = harness();
    const cache = await h.storage.open("collie-stt");
    cache.entries.set(`${ORIGIN}${sttModelPath("e".repeat(64))}`, new Response("x"));
    expect(await hasModel(h.deps)).toBe(false);
  });
});

describe("getEngineBytes", () => {
  async function downloaded(): Promise<Harness> {
    const h = harness();
    await downloadModel(READY, () => {}, undefined, h.deps);
    h.hashed.length = 0;
    h.fetchEngineFile.mockClear();
    return h;
  }

  it("returns the wasm and the model as fresh buffers every time, because the worker takes them", async () => {
    const h = await downloaded();
    const first = await getEngineBytes(h.deps);
    const second = await getEngineBytes(h.deps);
    expect(first.wasm).not.toBe(second.wasm);
    expect(first.model).not.toBe(second.model);
    expect([...new Uint8Array(first.model)]).toEqual([...MODEL]);
    expect(first.wasm.byteLength).toBe(WASM.byteLength);
  });

  it("hashes the stored model once per page session, not once per clip", async () => {
    const h = await downloaded();
    // The download itself just verified this copy, so the first read needs no second hash.
    await getEngineBytes(h.deps);
    const modelHashes = () => h.hashed.filter((length) => length === MODEL.byteLength).length;
    expect(modelHashes()).toBe(0);

    // A new page session: the verified set is gone, so the first read hashes once and the next none.
    __resetSttModel();
    await getEngineBytes(h.deps);
    await getEngineBytes(h.deps);
    expect(modelHashes()).toBe(1);
  });

  it("deletes a stored model that no longer matches, and says it is damaged", async () => {
    const h = await downloaded();
    __resetSttModel();
    const cache = h.storage.caches.get("collie-stt");
    cache?.entries.set(`${ORIGIN}${sttModelPath(SHA)}`, new Response(new TextEncoder().encode("tampered with, same-ish size"), { status: 200 }));
    const seen = vi.fn();
    subscribeStoredModel(seen);
    expect(await code(getEngineBytes(h.deps))).toBe("damaged");
    expect(cache?.entries.has(`${ORIGIN}${sttModelPath(SHA)}`)).toBe(false);
    expect(seen).toHaveBeenCalled();
    expect(await code(getEngineBytes(h.deps))).toBe("missing");
  });

  it("says missing when no model is stored", async () => {
    const h = harness();
    expect(await code(getEngineBytes(h.deps))).toBe("missing");
  });

  it("fetches the wasm from Collie's own files when the cache has no copy, checks it, and keeps it", async () => {
    const h = await downloaded();
    const cache = h.storage.caches.get("collie-stt");
    cache?.entries.delete(`${ORIGIN}${sttEnginePath("needle.wasm")}`);
    const bytes = await getEngineBytes(h.deps);
    expect(bytes.wasm.byteLength).toBe(WASM.byteLength);
    expect(h.fetchEngineFile).toHaveBeenCalledWith("needle.wasm", undefined);
    expect(cache?.entries.has(`${ORIGIN}${sttEnginePath("needle.wasm")}`)).toBe(true);
  });

  it("drops a cached wasm that fails its pin and refetches it", async () => {
    const h = await downloaded();
    const cache = h.storage.caches.get("collie-stt");
    cache?.entries.set(`${ORIGIN}${sttEnginePath("needle.wasm")}`, new Response(new Uint8Array(10), { status: 200 }));
    const bytes = await getEngineBytes(h.deps);
    expect(bytes.wasm.byteLength).toBe(WASM.byteLength);
    expect(h.fetchEngineFile).toHaveBeenCalledTimes(1);
  });

  it("refuses a wasm that is not the pinned file", async () => {
    const h = await downloaded();
    h.storage.caches.get("collie-stt")?.entries.delete(`${ORIGIN}${sttEnginePath("needle.wasm")}`);
    const deps = { ...h.deps, fetchEngineFile: vi.fn(async () => new Response(new Uint8Array(5), { status: 200 })) };
    expect(await code(getEngineBytes(deps))).toBe("engine-mismatch");
  });
});

describe("removeModel", () => {
  it("deletes the whole speech cache: the model and the engine files with it", async () => {
    const h = harness();
    await downloadModel(READY, () => {}, undefined, h.deps);
    await removeModel(h.deps);
    expect(h.storage.caches.has("collie-stt")).toBe(false);
    expect(await hasModel(h.deps)).toBe(false);
  });

  it("leaves other caches alone", async () => {
    const h = harness();
    await downloadModel(READY, () => {}, undefined, h.deps);
    await h.storage.open("collie-fonts");
    await removeModel(h.deps);
    expect(h.storage.caches.has("collie-fonts")).toBe(true);
  });
});
