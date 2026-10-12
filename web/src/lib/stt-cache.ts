// WHAT THE PHONE KEEPS FOR ITS OWN SPEECH ENGINE, AND WHAT IT KEEPS IT UNDER (ADR 0096 Decision 10).
//
// One Cache Storage cache holds the Whistle model and the engine files, and two sides read it: the
// page (lib/stt-model.ts downloads into it and reads the bytes back) and the service worker (src/sw.ts
// answers `stt/` from it and sweeps it). So the names and the one rule about what survives a sweep
// live here, free of workbox imports, where a unit test can reach them and the two sides cannot drift.
//
// The model entry is keyed by an API-shaped URL, `/api/stt/model/<sha256>`, because that is the
// address it was fetched from. It is never requested from the cache by the service worker, which has
// no route for `/api/`; only the page reads it, with `caches.match`. The worker's own route is
// `stt/` and nothing else (ADR 0087: no service-worker cache of API answers).

import { ACCEPTED_WHISTLE_SHAS, NEEDLE_JS_SHA256, NEEDLE_VERSION_DIR, NEEDLE_WASM_SHA256 } from "../stt/pins";

/** The cache's name at the origin root. A mount adds `:<mount>` (below), the way the font cache does. */
export const STT_CACHE_PREFIX = "collie-stt";

/** Named per mount (ADR 0052): two collies on one origin share one Cache Storage. */
export function sttCacheName(mount: string): string {
  return mount === "/" ? STT_CACHE_PREFIX : `${STT_CACHE_PREFIX}:${mount}`;
}

/** True for a cache of this feature, whatever the mount. lib/pwa.ts keeps these through its recovery. */
export function isSttCacheName(name: string): boolean {
  return name.startsWith(STT_CACHE_PREFIX);
}

/** The two engine files the worker needs, vendored under `stt/<version>/` (web/public/stt). */
export const STT_ENGINE_FILES = ["needle.js", "needle.wasm"] as const;
export type SttEngineFile = (typeof STT_ENGINE_FILES)[number];

/** The model's key, root-absolute and mount-free. */
export function sttModelPath(sha256: string): string {
  return `/api/stt/model/${sha256}`;
}

/** An engine file's path, root-absolute and mount-free. */
export function sttEnginePath(file: SttEngineFile): string {
  return `/stt/${NEEDLE_VERSION_DIR}/${file}`;
}

/** The part of a pathname under the mount, root-absolute again: `/collie/stt/x` at `/collie/` is `/stt/x`. */
export function stripMount(pathname: string, mount: string): string {
  if (mount === "/") return pathname;
  const prefix = mount.slice(0, -1);
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}

const MODEL_PATH = /^\/api\/stt\/model\/([0-9a-f]{64})$/;

/** The hash a model key names, or `null` when the path is not a model key. */
export function modelShaOfPath(path: string): string | null {
  return MODEL_PATH.exec(path)?.[1] ?? null;
}

/**
 * Whether the service worker's activate sweep keeps an entry. Mount-free path in.
 *
 * Kept: a model whose hash THIS build still accepts, and this build's engine files. Dropped: every
 * other model, an engine from another version, and the worker script. The worker is dropped on
 * purpose, because its name carries a build hash and an old one must not outlive its build; the next
 * load of the new worker puts the new one back (sw.ts).
 */
export function sttSweepKeeps(path: string, accepted: readonly string[] = ACCEPTED_WHISTLE_SHAS): boolean {
  const sha = modelShaOfPath(path);
  if (sha !== null) return accepted.includes(sha);
  return STT_ENGINE_FILES.some((file) => sttEnginePath(file) === path);
}

/**
 * Whether a response may be stored under `path` (mount-free). This cache is permanent, so a wrong
 * entry is permanent too: the font cache's rule, one layer down. An unredirected 200 that claims the
 * type the path promises. A fronting proxy with an expired session answers a subresource with
 * 302 to 200 sign-in HTML, and `response.ok` is true for that.
 */
export function sttStorable(response: Response, path: string): boolean {
  if (response.status !== 200 || response.redirected) return false;
  const type = (response.headers.get("content-type") ?? "").toLowerCase();
  if (modelShaOfPath(path) !== null) return type.includes("octet-stream");
  if (path.endsWith(".wasm")) return type.includes("wasm");
  if (path.endsWith(".js")) return type.includes("javascript");
  return false;
}

/** The engine's folder, mount-free: everything under it is pinned, file by file. */
const ENGINE_DIR = `/stt/${NEEDLE_VERSION_DIR}/`;

/** The sha256 each engine file must have to be stored, by its mount-free path. */
const ENGINE_PINS: ReadonlyMap<string, string> = new Map([
  [sttEnginePath("needle.js"), NEEDLE_JS_SHA256],
  [sttEnginePath("needle.wasm"), NEEDLE_WASM_SHA256],
]);

function hex(digest: ArrayBuffer): string {
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * What the service worker puts in the cache for a response {@link sttStorable} already took, or null
 * for nothing. A file in the engine's folder is stored only as the bytes whose sha256 is that file's
 * pin (src/stt/pins.ts): this cache outlives every reload, so a wrong engine served once (a proxy,
 * a half-deployed build) would otherwise be the engine from then on. The copy is built from exactly
 * the bytes that were hashed. Any other file there is not stored at all, and everything outside the
 * folder (the worker script) is stored as it came. The response passed in is consumed.
 */
export async function sttCopyToStore(
  response: Response,
  path: string,
  digest: (bytes: ArrayBuffer) => Promise<ArrayBuffer> = (bytes) => crypto.subtle.digest("SHA-256", bytes),
): Promise<Response | null> {
  if (!path.startsWith(ENGINE_DIR)) return response;
  const pin = ENGINE_PINS.get(path);
  if (pin === undefined) return null;
  const bytes = await response.arrayBuffer();
  if (hex(await digest(bytes)) !== pin) return null;
  return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
}
