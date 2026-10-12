// THE PHONE'S MODEL STORE (ADR 0096 Decisions 2, 7 and 10).
//
// "This phone" runs Whistle in a worker (stt/worker.ts, lib/stt-engine.ts), and the worker has no
// network: the page hands it the bytes. This module is where the page gets them. It copies the model
// from the HOST, never from a third party, checks it, keeps it in Cache Storage, and reads it back.
//
// WHAT MAKES A COPY TRUSTED, in the order the code checks it:
//   1. The host reported a hash, and this build accepts that hash (stt/pins.ts). A host that holds a
//      model this build does not know is not asked for it.
//   2. The bytes that arrived are exactly the length the host reported, and their sha256 equals both
//      the hash the host reported and a hash this build accepts. Only then is anything stored.
//   3. What is stored is a fresh 200 built from the bytes that were hashed, never the response that
//      carried them, so a redirect, a header or a status from the wire cannot end up in the cache.
//   4. Once per page session, before the first use, the stored copy is hashed again. A copy that
//      changed on disk is deleted and reported as damaged, not used.
//
// THE ENGINE FILES COME WITH IT (`needle.js`, `needle.wasm`), fetched from Collie's own static files
// and held to their pins, so "This phone" also works offline. The worker script itself is not known
// to this module (Vite names it with a build hash and the page cannot ask for the URL without
// copying the file as an asset); the service worker puts it in the same cache the first time the
// worker loads after the model is here (sw.ts).
//
// NOTHING HERE STARTS A DOWNLOAD BY ITSELF. `downloadModel` runs on a tap, in Settings.

import { apiErrorFields, fetchSttModel, isApiErrorStatus } from "@/lib/api";
import { basePath, mounted } from "@/lib/base-path";
import {
  modelShaOfPath,
  STT_ENGINE_FILES,
  sttCacheName,
  sttEnginePath,
  sttModelPath,
  sttStorable,
  type SttEngineFile,
} from "@/lib/stt-cache";
import type { SttEngineBytes } from "@/lib/stt-engine";
import type { WhistleStatus } from "@/lib/types";
import {
  ACCEPTED_WHISTLE_SHAS,
  NEEDLE_JS_BYTES,
  NEEDLE_JS_SHA256,
  NEEDLE_WASM_BYTES,
  NEEDLE_WASM_SHA256,
  WHISTLE_MODEL_BYTES,
} from "@/stt/pins";

export type SttModelErrorCode =
  /** No Cache Storage here (an insecure origin, or a browser without it). */
  | "unsupported"
  /** Free space is under twice the model's size. Nothing was fetched. */
  | "low-space"
  /** The host's model is not one this build accepts, or the host is not ready. Nothing was fetched. */
  | "unknown-model"
  /** The copy broke: a refusal, a lost link, a short body. */
  | "download-failed"
  /** The host is already copying the model to two phones (`503 stt.model_busy`, `retry-after: 5`).
   *  Retryable: nothing is wrong, the host asks for a few seconds. */
  | "busy"
  /** The bytes did not hash to what the host reported, or to anything this build accepts. Nothing was kept. */
  | "hash-mismatch"
  /** An engine file did not match its pin. Nothing was kept. */
  | "engine-mismatch"
  /** The caller's signal ended the copy. */
  | "aborted"
  /** The browser refused to store it (quota). */
  | "storage-failed"
  /** The stored model no longer matches its hash. The entry is deleted. */
  | "damaged"
  /** There is no stored model to read. */
  | "missing";

/** A typed failure. `cause` carries the thrown value behind `download-failed`, so a caller can say the host's own refusal. */
export class SttModelError extends Error {
  readonly code: SttModelErrorCode;
  constructor(code: SttModelErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? code, options);
    this.name = "SttModelError";
    this.code = code;
  }
}

/**
 * What the phone holds. `bytes` is the length the entry declared when it was stored. `revision` is the
 * Hugging Face revision the host said the file came from, kept beside the entry so Settings can name
 * the version; a copy stored before that was recorded has none, and Settings falls back to the hash.
 */
export interface StoredModel {
  sha256: string;
  bytes: number;
  revision?: string;
}

/** The header the stored entry carries its revision in. Ours alone: nothing on the wire sets it. */
export const MODEL_REVISION_HEADER = "x-collie-model-revision";

/** A revision is shown and put in a link, so it is held to the shape of a plain name. */
function plainRevision(value: string | null | undefined): string | undefined {
  return value !== null && value !== undefined && /^[0-9A-Za-z._-]{1,64}$/.test(value) ? value : undefined;
}

/** The part of a `Cache` the store uses, so a test can hand in a fake. */
export interface ModelCache {
  put: (key: string, response: Response) => Promise<void>;
  match: (key: string) => Promise<Response | undefined>;
  keys: () => Promise<readonly Request[]>;
  delete: (key: string | Request) => Promise<boolean>;
}

/** The part of `CacheStorage` the store uses. */
export interface ModelCacheStorage {
  has: (name: string) => Promise<boolean>;
  open: (name: string) => Promise<ModelCache>;
  delete: (name: string) => Promise<boolean>;
}

/** The environment the store touches, so a test can hand in fakes. */
export interface SttModelDeps {
  caches: ModelCacheStorage | undefined;
  mount: () => string;
  origin: () => string;
  /** Stream the model by hash from the host. Throws on a refusal. */
  fetchModel: (sha256: string, signal?: AbortSignal) => Promise<Response>;
  /** Fetch one vendored engine file from Collie's own static files. */
  fetchEngineFile: (file: SttEngineFile, signal?: AbortSignal) => Promise<Response>;
  digest: (bytes: BufferSource) => Promise<ArrayBuffer>;
  estimate: () => Promise<{ quota?: number; usage?: number } | null>;
  persist: () => Promise<boolean>;
  persisted: () => Promise<boolean>;
}

function realDeps(): SttModelDeps {
  return {
    caches: globalThis.caches,
    mount: basePath,
    origin: () => globalThis.location.origin,
    fetchModel: fetchSttModel,
    fetchEngineFile: (file, signal) => fetch(mounted(sttEnginePath(file)), { signal, credentials: "same-origin" }),
    digest: (bytes) => crypto.subtle.digest("SHA-256", bytes),
    estimate: async () => (await navigator.storage?.estimate?.()) ?? null,
    persist: async () => (await navigator.storage?.persist?.()) ?? false,
    persisted: async () => (await navigator.storage?.persisted?.()) ?? false,
  };
}

/** Free space the download needs: the model, twice. The bytes are held once in memory and once in the store. */
export const MODEL_SPACE_FACTOR = 2;

/** Progress as bytes received of bytes expected. */
export type ModelProgress = (received: number, total: number) => void;

/** What a finished download reports. */
export interface DownloadedModel extends StoredModel {
  /** Whether the browser agreed to keep the copy when space runs low (`navigator.storage.persist()`). */
  persisted: boolean;
}

// ── Change notice ─────────────────────────────────────────────────────────────────────────────────
// The Settings card and the composer both want to know when the stored model appears or goes.

const listeners = new Set<() => void>();

/** Call `fn` whenever the stored model is added, replaced or removed. Returns the unsubscribe. */
export function subscribeStoredModel(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function changed(): void {
  for (const fn of listeners) fn();
}

/** Hashes of stored copies hashed again in THIS page session (Decision 10). Cleared with the page. */
const verifiedThisSession = new Set<string>();

/** Test helper: forget the session's verified copies and every listener. */
export function __resetSttModel(): void {
  verifiedThisSession.clear();
  listeners.clear();
}

// ── Small helpers ─────────────────────────────────────────────────────────────────────────────────

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

function keyFor(deps: SttModelDeps, path: string): string {
  const mount = deps.mount();
  const prefix = mount === "/" ? "" : mount.slice(0, -1);
  return new URL(`${prefix}${path}`, deps.origin()).href;
}

async function openCache(deps: SttModelDeps, create: boolean): Promise<ModelCache | null> {
  const storage = deps.caches;
  if (storage === undefined) throw new SttModelError("unsupported");
  const name = sttCacheName(deps.mount());
  // Reading must not create a cache for a phone that never downloaded anything.
  if (!create && !(await storage.has(name))) return null;
  return storage.open(name);
}

function isAbort<TThrown>(error: TThrown, signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true || (error instanceof Error && error.name === "AbortError");
}

/** Read a response into one buffer, counting as it goes and refusing more than `limit` bytes. */
async function readCounted(
  response: Response,
  limit: number,
  onChunk: (received: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  const body = response.body;
  if (body === null) {
    const whole = new Uint8Array(await response.arrayBuffer());
    if (whole.byteLength > limit) throw new SttModelError("hash-mismatch", "more bytes than the host reported");
    onChunk(whole.byteLength);
    return whole;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > limit) {
      void reader.cancel().catch(() => null);
      throw new SttModelError("hash-mismatch", "more bytes than the host reported");
    }
    chunks.push(value);
    onChunk(received);
  }
  const whole = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    whole.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return whole;
}

const ENGINE_PINS = {
  "needle.js": { sha256: NEEDLE_JS_SHA256, bytes: NEEDLE_JS_BYTES, type: "text/javascript" },
  "needle.wasm": { sha256: NEEDLE_WASM_SHA256, bytes: NEEDLE_WASM_BYTES, type: "application/wasm" },
} as const satisfies Record<SttEngineFile, { sha256: string; bytes: number; type: string }>;

/** Fetch one engine file and hold it to its pin. Throws `engine-mismatch` or `download-failed`. */
async function fetchEngineChecked(deps: SttModelDeps, file: SttEngineFile, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  const pin = ENGINE_PINS[file];
  let response: Response;
  try {
    response = await deps.fetchEngineFile(file, signal);
  } catch (error) {
    if (isAbort(error, signal)) throw new SttModelError("aborted");
    throw new SttModelError("download-failed", `${file} could not be fetched`, { cause: error });
  }
  if (response.status !== 200 || response.redirected) {
    throw new SttModelError("download-failed", `${file} answered ${String(response.status)}`);
  }
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = await readCounted(response, pin.bytes, () => {});
  } catch (error) {
    if (error instanceof SttModelError) throw new SttModelError("engine-mismatch", `${file} is not the pinned file`);
    throw isAbort(error, signal) ? new SttModelError("aborted") : new SttModelError("download-failed", undefined, { cause: error });
  }
  if (bytes.byteLength !== pin.bytes || hex(await deps.digest(bytes)) !== pin.sha256) {
    throw new SttModelError("engine-mismatch", `${file} is not the pinned file`);
  }
  return bytes;
}

// ── The public surface ────────────────────────────────────────────────────────────────────────────

/**
 * Copy the host's model to this phone.
 *
 * `status` is the host's answer (`GET /api/stt/whistle`, or `/api/config`): it must be `ready` and
 * carry a hash this build accepts. Refuses at once, with nothing fetched, when free space is under
 * twice the model's size. Streams with progress against `status.bytes`. Stores only after both hashes
 * agree, replaces an older copy, and asks the browser to keep the result (`persist()`); the answer
 * rides back so Settings can say what it means.
 */
export async function downloadModel(
  status: WhistleStatus,
  onProgress: ModelProgress,
  signal?: AbortSignal,
  deps: SttModelDeps = realDeps(),
): Promise<DownloadedModel> {
  const sha256 = status.sha256;
  if (status.state !== "ready" || sha256 === undefined || !ACCEPTED_WHISTLE_SHAS.includes(sha256)) {
    throw new SttModelError("unknown-model");
  }
  if (deps.caches === undefined) throw new SttModelError("unsupported");

  const estimate = await deps.estimate().catch(() => null);
  if (estimate?.quota !== undefined && estimate.usage !== undefined) {
    if (estimate.quota - estimate.usage < MODEL_SPACE_FACTOR * status.bytes) throw new SttModelError("low-space");
  }

  // The engine first: it is small, and a bad one should fail before 17 MB are spent.
  const engine = new Map<SttEngineFile, Uint8Array<ArrayBuffer>>();
  for (const file of STT_ENGINE_FILES) engine.set(file, await fetchEngineChecked(deps, file, signal));

  let response: Response;
  try {
    response = await deps.fetchModel(sha256, signal);
  } catch (error) {
    if (isAbort(error, signal)) throw new SttModelError("aborted");
    // Compared as a plain string: the code is the bridge's, and a build that has no sentence for it
    // must still treat it as the retryable thing it is.
    if (isApiErrorStatus(error, 503) && apiErrorFields(error)?.code === "stt.model_busy") {
      throw new SttModelError("busy", "the host is busy copying the model to other phones", { cause: error });
    }
    throw new SttModelError("download-failed", "the host refused the model", { cause: error });
  }
  if (response.status !== 200 || response.redirected) {
    throw new SttModelError("download-failed", `the host answered ${String(response.status)}`);
  }

  let bytes: Uint8Array<ArrayBuffer>;
  onProgress(0, status.bytes);
  try {
    bytes = await readCounted(response, status.bytes, (received) => onProgress(received, status.bytes));
  } catch (error) {
    if (error instanceof SttModelError) throw error;
    if (isAbort(error, signal)) throw new SttModelError("aborted");
    throw new SttModelError("download-failed", "the copy broke", { cause: error });
  }
  if (bytes.byteLength !== status.bytes) throw new SttModelError("download-failed", "the copy ended short");

  const got = hex(await deps.digest(bytes));
  if (got !== sha256 || !ACCEPTED_WHISTLE_SHAS.includes(got)) throw new SttModelError("hash-mismatch");

  const cache = await openCache(deps, true);
  if (cache === null) throw new SttModelError("unsupported");
  const modelKey = keyFor(deps, sttModelPath(sha256));
  const revision = plainRevision(status.revision);
  const headers = new Headers({ "content-type": "application/octet-stream", "content-length": String(bytes.byteLength) });
  if (revision !== undefined) headers.set(MODEL_REVISION_HEADER, revision);
  try {
    await cache.put(modelKey, new Response(bytes, { status: 200, headers }));
    for (const file of STT_ENGINE_FILES) {
      const stored = engine.get(file);
      if (stored === undefined) continue;
      await cache.put(
        keyFor(deps, sttEnginePath(file)),
        new Response(stored, { status: 200, headers: { "content-type": ENGINE_PINS[file].type } }),
      );
    }
  } catch (error) {
    await cache.delete(modelKey).catch(() => false);
    throw new SttModelError("storage-failed", undefined, { cause: error });
  }
  // A newer model replaces the older one; two copies of 17 MB is a cost nobody chose.
  for (const request of await cache.keys()) {
    const other = modelShaOfPath(pathOfKey(request, deps));
    if (other !== null && other !== sha256) await cache.delete(request);
  }

  verifiedThisSession.add(sha256);
  const persisted = await deps.persist().catch(() => false);
  changed();
  const done: DownloadedModel = { sha256, bytes: bytes.byteLength, persisted };
  if (revision !== undefined) done.revision = revision;
  return done;
}

/** The mount-free path of a cache key. */
function pathOfKey(request: Request, deps: SttModelDeps): string {
  const mount = deps.mount();
  const { pathname } = new URL(request.url);
  if (mount === "/") return pathname;
  const prefix = mount.slice(0, -1);
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}

/** The model the phone holds, or `null`. Only a hash this build accepts counts; anything else is not a model here. */
export async function storedModel(deps: SttModelDeps = realDeps()): Promise<StoredModel | null> {
  const cache = await openCache(deps, false).catch(() => null);
  if (cache === null) return null;
  for (const request of await cache.keys()) {
    const sha256 = modelShaOfPath(pathOfKey(request, deps));
    if (sha256 === null || !ACCEPTED_WHISTLE_SHAS.includes(sha256)) continue;
    const entry = await cache.match(request.url);
    const declared = Number(entry?.headers.get("content-length"));
    const revision = plainRevision(entry?.headers.get(MODEL_REVISION_HEADER));
    const held: StoredModel = { sha256, bytes: Number.isFinite(declared) && declared > 0 ? declared : WHISTLE_MODEL_BYTES };
    if (revision !== undefined) held.revision = revision;
    return held;
  }
  return null;
}

/** Whether this phone holds a model this build can run. */
export async function hasModel(deps: SttModelDeps = realDeps()): Promise<boolean> {
  return (await storedModel(deps)) !== null;
}

/** Whether the browser promised to keep the copy when space runs low. */
export function modelPersisted(deps: SttModelDeps = realDeps()): Promise<boolean> {
  return deps.persisted().catch(() => false);
}

/** Delete the phone's copy: the model, the engine files and anything else this feature keeps. */
export async function removeModel(deps: SttModelDeps = realDeps()): Promise<void> {
  const storage = deps.caches;
  if (storage === undefined) return;
  await storage.delete(sttCacheName(deps.mount()));
  verifiedThisSession.clear();
  changed();
}

async function dropEntry(deps: SttModelDeps, path: string): Promise<void> {
  const cache = await openCache(deps, false).catch(() => null);
  await cache?.delete(keyFor(deps, path)).catch(() => false);
  changed();
}

/**
 * The two buffers `lib/stt-engine.ts` transfers to its worker: the wasm and the model. This is the
 * engine's `getBytes`. Each call returns FRESH buffers, because the worker takes them.
 *
 * The model is hashed again the first time it is read in a page session; a copy that no longer matches
 * is deleted and reported as damaged. The wasm is checked against its pin on every read, a megabyte;
 * from the cache when it is there, from Collie's own static files when it is not.
 */
export async function getEngineBytes(deps: SttModelDeps = realDeps()): Promise<SttEngineBytes> {
  const held = await storedModel(deps);
  if (held === null) throw new SttModelError("missing");
  const cache = await openCache(deps, false);
  const stored = await cache?.match(keyFor(deps, sttModelPath(held.sha256)));
  if (stored === undefined) throw new SttModelError("missing");
  const model = await stored.arrayBuffer();
  if (!verifiedThisSession.has(held.sha256)) {
    if (hex(await deps.digest(model)) !== held.sha256) {
      await dropEntry(deps, sttModelPath(held.sha256));
      throw new SttModelError("damaged");
    }
    verifiedThisSession.add(held.sha256);
  }

  const wasmKey = keyFor(deps, sttEnginePath("needle.wasm"));
  const cachedWasm = await cache?.match(wasmKey);
  if (cachedWasm !== undefined) {
    const wasm = await cachedWasm.arrayBuffer();
    if (wasm.byteLength === NEEDLE_WASM_BYTES && hex(await deps.digest(wasm)) === NEEDLE_WASM_SHA256) {
      return { wasm, model };
    }
    await dropEntry(deps, sttEnginePath("needle.wasm"));
  }
  const fetched = await fetchEngineChecked(deps, "needle.wasm");
  const wasm = fetched.buffer.slice(fetched.byteOffset, fetched.byteOffset + fetched.byteLength);
  if (cache !== null) {
    const copy = new Response(fetched, { status: 200, headers: { "content-type": ENGINE_PINS["needle.wasm"].type } });
    if (sttStorable(copy, sttEnginePath("needle.wasm"))) await cache.put(wasmKey, copy).catch(() => null);
  }
  return { wasm, model };
}
