import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { constants, existsSync, statSync } from "node:fs";
import { type FileHandle, chmod, lstat, mkdir, open, readdir, readFile, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { BlockList, isIP } from "node:net";
import { join } from "node:path";

import type { JsonValue } from "../json.ts";
import type { WhistleStatus } from "../types.ts";
import { jsonRecord, jsonStringField } from "./json.ts";
import { ACCEPTED_WHISTLE_SHAS, NEEDLE_JS_BYTES, NEEDLE_VERSION_DIR, NEEDLE_WASM_BYTES, WHISTLE_MODEL } from "./whistle-pins.ts";

// ── THE WHISTLE MODEL ON THE HOST (ADR 0096 Decision 2) ──────────────────────────────────────
//
// One file, `<stateDir>/whistle/whistle.cact`, with a manifest beside it. Two acts put it there
// and nothing else does: a tap in Settings (`POST /api/stt/whistle`) and `collie stt whistle`. Both
// come through {@link createWhistleModelStore}. This module is the bridge's SECOND outbound path,
// beside the update check, and it is bounded like this:
//
//   • one address — the pinned Hugging Face commit URL in `whistle-pins.ts`, never a client value,
//     with an honest `User-Agent: Collie/<version>`. Redirects are followed BY HAND: the CDN host
//     behind it differs by region and has changed before (ADR 0096 Decision 7), so a hop is taken,
//     but at most {@link WHISTLE_MAX_REDIRECTS} of them, each `https:`, and none to `localhost`, to
//     a loopback, private, link-local or unique-local address, or to a name that resolves to one.
//     The bridge's outbound path must not become a way to reach the host's own network. (The check
//     resolves the name, and `fetch` resolves it again: a name that changes its answer in between
//     is not caught. The hash gate still refuses whatever such a hop delivers.)
//   • one download in flight per process — a second start joins the first, and a start when the
//     held file already matches a pin answers "ready" without a request.
//   • one download in flight per FOLDER, across processes: the bridge and a `collie stt whistle` run
//     are separate processes, so `whistle.lock` is the signal. It is created exclusively (`wx`) and
//     holds the pid, the start time and the name of that download's part file. One younger than the
//     deadline belongs to a download that may still be running, and a second downloader reports
//     that and fetches nothing. One older than the deadline is a crash's, and is removed with the
//     part files no live lock names. (Two processes that both judge the same stale lock can still
//     race once and both download. Each writes its OWN part file and renames only that one, after
//     its own hash gate, so the model that lands is whole either way.)
//   • a cap at the pinned size, counted on the bytes as they arrive, and a 10-minute deadline.
//   • streamed to `whistle.cact.<pid>.<seq>.part` (0600, created exclusively, this download's
//     alone) with a running sha256, and renamed into place only when the hash equals the pin. Any
//     failure deletes that part file and records a short reason, which `GET /api/stt/whistle`
//     reports. No path, no address and no upstream body ever reaches that reason.
//   • the folder is 0700, every file 0600, and a symlink at any of the paths is refused (lstat): the
//     state dir is the operator's, but nothing here follows a link out of it.
//
// The held file's hash is computed once per change of its size, mtime or inode, not per request:
// `/api/config` asks for it on every page load and a 17 MB hash is not free.

export const WHISTLE_MODEL_FILENAME = "whistle.cact";
export const WHISTLE_MANIFEST_FILENAME = "whistle.json";
export const WHISTLE_LOCK_FILENAME = "whistle.lock";

/** A download's part file: `whistle.cact.<pid>.<seq>.part`, one per download, never shared. */
export function whistlePartName(pid: number, seq: number): string {
  return `${WHISTLE_MODEL_FILENAME}.${pid}.${seq}.part`;
}

const PART_NAME = /^whistle\.cact\.\d+\.\d+\.part$/;
const MANIFEST_TEMP_NAME = /^whistle\.json\.\d+\.\d+\.tmp$/;

/**
 * The fixed names this module writes into the folder, for the Windows access-list rule that judges
 * the folder "Collie's own" (bridge/acl-policy.ts `KNOWN_FOLDERS`, which keeps a pattern of its own;
 * a test holds the two together, with {@link whistlePartName} and the manifest's temporary,
 * `whistle.json.<pid>.<seq>.tmp`).
 */
export const WHISTLE_FOLDER_NAMES = [WHISTLE_MODEL_FILENAME, WHISTLE_MANIFEST_FILENAME, WHISTLE_LOCK_FILENAME] as const;

/** How many redirects a download follows before it gives up. */
export const WHISTLE_MAX_REDIRECTS = 5;

/** How long one download may take, request to rename. 18 MB took 29 s over a tailnet. */
export const WHISTLE_DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;

/** The paths of the model, its manifest and the download lock, under one state dir. */
export interface WhistlePaths {
  dir: string;
  model: string;
  manifest: string;
  lock: string;
}

export function whistlePaths(stateDir: string): WhistlePaths {
  // Spelled out rather than through a constant, so the state-dir guard (solo-baseline.test.ts) reads it.
  // A folder of its own, one level under the state dir: the Windows access-list rule judges a folder
  // "Collie's own" one level deep, and a `stt/` holding a subfolder would fail it.
  const dir = join(stateDir, "whistle");
  return {
    dir,
    model: join(dir, WHISTLE_MODEL_FILENAME),
    manifest: join(dir, WHISTLE_MANIFEST_FILENAME),
    lock: join(dir, WHISTLE_LOCK_FILENAME),
  };
}

/**
 * The folder the vendored engine is read from: the served copy in `web/dist/stt/<version>/`, or in a
 * source checkout with no web build yet, the vendored copy in `web/public/stt/<version>/` that Vite
 * would copy there byte for byte. Either way the bytes are checked against the pins before use.
 */
export function whistleEngineDir(root: string): string {
  const served = join(root, "web", "dist", "stt", NEEDLE_VERSION_DIR);
  if (existsSync(join(served, "needle.js"))) return served;
  return join(root, "web", "public", "stt", NEEDLE_VERSION_DIR);
}

/**
 * Whether the two engine files are in place at their pinned sizes. A cheap check for the provider's
 * status, asked on every config read; the child hashes both before it compiles anything.
 */
export function whistleEngineInPlace(root: string): boolean {
  const dir = whistleEngineDir(root);
  try {
    return statSync(join(dir, "needle.js")).size === NEEDLE_JS_BYTES && statSync(join(dir, "needle.wasm")).size === NEEDLE_WASM_BYTES;
  } catch {
    return false;
  }
}

/** What the store reports. The route adds the host engine's two flags to make a `WhistleStatus`. */
export type WhistleModelStatus = Pick<WhistleStatus, "state" | "bytes" | "received" | "sha256" | "revision" | "fetchedAt" | "reason">;

/** The manifest beside the model: where it came from, for `collie stt status` and `doctor`. */
export interface WhistleManifest {
  version: 1;
  model: { sha256: string; bytes: number; revision: string; source: string; fetchedAt: string };
}

/** A revision is a plain name (a commit hash in production); anything else is not passed on. */
const PLAIN_REVISION = /^[0-9A-Za-z._-]{1,64}$/;

/** The model a download aims at. {@link WHISTLE_MODEL} unless a test pins a small one. */
export interface WhistleModelPin {
  url: string;
  revision: string;
  sha256: string;
  bytes: number;
}

/** The slice of `fetch` the download uses, so a test can stand in for Hugging Face. */
export type WhistleFetch = (url: string, init: RequestInit) => Promise<Response>;

/** Every address a host name resolves to, so a test can stand in for DNS. */
export type WhistleLookup = (hostname: string) => Promise<readonly string[]>;

export interface WhistleModelDeps {
  stateDir: string;
  /** Collie's version, for the `User-Agent`. */
  version: string;
  fetch?: WhistleFetch;
  /** How a hop's host name is resolved before it is asked. `node:dns` unless a test names its own. */
  lookup?: WhistleLookup;
  /** The clock the manifest's `fetchedAt` reads. */
  now?: () => number;
  pin?: WhistleModelPin;
  /** The hashes this build accepts. {@link ACCEPTED_WHISTLE_SHAS} unless a test names its own. */
  accepted?: readonly string[];
  /** The most bytes a download or an import may deliver. The pin's size unless a test names its own. */
  capBytes?: number;
  timeoutMs?: number;
}

/** The held model, once its hash is one this build accepts. */
export interface WhistleReady {
  path: string;
  sha256: string;
  bytes: number;
}

/**
 * What `start()` did: joined or began a download, found the model already in place, or could not
 * begin. `elsewhere` is set on "downloading" when the download belongs to ANOTHER process (a lock
 * younger than the deadline): this one fetched nothing, and `status.received` is the size of the
 * part file that lock names.
 */
export type WhistleStart =
  | { outcome: "ready"; status: WhistleModelStatus }
  | { outcome: "downloading"; status: WhistleModelStatus; elsewhere?: boolean }
  | { outcome: "refused"; reason: string };

export interface WhistleModelStore {
  readonly paths: WhistlePaths;
  status(): Promise<WhistleModelStatus>;
  /** The held model when its hash is accepted, else null. Stat-cheap after the first hash. */
  ready(): Promise<WhistleReady | null>;
  /** Start the download, or join the one in flight. Idempotent when the model is ready. */
  start(): Promise<WhistleStart>;
  /**
   * Take a local file instead of a download (`collie stt whistle --from`), through the same single
   * flight, the same lock, a part file of its own and the same hash gate. A symlink or a non-file is refused before
   * anything is touched; a file whose hash is not the pin ends as a failure naming both hashes.
   */
  importFile(source: string): Promise<WhistleStart>;
  /** The model as the terminal reports it: absent, downloading, ready, not this release's, or unreadable. */
  describe(): Promise<WhistleDescription>;
  /**
   * Stop this process's download in flight and delete the model and its manifest. Another process's
   * live download keeps its lock and its part file; a dead one's are removed.
   */
  remove(): Promise<WhistleModelStatus>;
  /** Resolves when no download is in flight. For tests and for `collie stt whistle`. */
  settled(): Promise<void>;
  /** The manifest, or null when there is none or it cannot be read. */
  manifest(): Promise<WhistleManifest | null>;
}

/** What {@link WhistleModelStore.describe} reports. */
export type WhistleDescription =
  | { kind: "absent" }
  | { kind: "downloading"; received: number }
  | { kind: "ready"; sha256: string; bytes: number; revision: string | null }
  /** A file is there and readable, but its hash is not one this release accepts. */
  | { kind: "mismatch"; sha256: string; bytes: number }
  /** A file is there and cannot be read, or is a symlink or not a file. */
  | { kind: "unreadable"; reason: string };

/** A refusal whose message is Collie's own sentence and safe to report: no path, no upstream body. */
class WhistleRefusal extends Error {}

/** Another process holds the lock. Not a failure of this one, and nothing of theirs is touched. */
class WhistleRunning extends Error {}

/** What a download holds while it runs: its own part file, and the lock text it wrote. */
interface Prepared {
  file: FileHandle;
  part: string;
  lockText: string;
}

/** Part files and manifest temporaries made by this process, for their names. */
let writeSeq = 0;

/** The redirect statuses a download follows. */
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/**
 * The addresses a download never goes to: loopback, the private ranges, the tailnet's CGNAT range,
 * link-local, unique-local, unspecified, IPv4-compatible, multicast and reserved. IPv4-mapped IPv6 is
 * checked as v4.
 */
const NOT_PUBLIC = (() => {
  const list = new BlockList();
  for (const [net, bits] of [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.168.0.0", 16],
    ["224.0.0.0", 3],
  ] as const) {
    list.addSubnet(net, bits, "ipv4");
  }
  for (const [net, bits] of [
    ["::", 96],
    ["fc00::", 7],
    ["fe80::", 10],
    ["fec0::", 10],
    ["ff00::", 8],
  ] as const) {
    list.addSubnet(net, bits, "ipv6");
  }
  return list;
})();

/** Whether a literal IP address is one a download may reach. Exported for the test. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  return !NOT_PUBLIC.check(address, family === 4 ? "ipv4" : "ipv6");
}

/** What would change if the lock were replaced: a stale lock is removed only while this holds. */
function lockIdentity(entry: { ino: number; size: number; mtimeMs: number }): string {
  return `${entry.ino}:${entry.size}:${entry.mtimeMs}`;
}

async function dnsLookup(hostname: string): Promise<readonly string[]> {
  return (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);
}

/** A download in flight, shared by every store over the same folder in this process. */
interface InFlight {
  done: Promise<void>;
  received: number;
  controller: AbortController;
}

const inFlight = new Map<string, InFlight>();
/** The last failure per folder, until the next start or remove. In memory: a restart forgets it. */
const lastFailure = new Map<string, string>();
/** The held file's hash per path, keyed by what would change if the file did. */
const hashCache = new Map<string, { key: string; sha256: string }>();

/** Forget every download, failure and hash this process holds. For tests. */
export function resetWhistleModelState(): void {
  for (const flight of inFlight.values()) flight.controller.abort();
  inFlight.clear();
  lastFailure.clear();
  hashCache.clear();
}

/** The sha256 of a file, streamed. */
async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of Bun.file(path).stream()) hash.update(chunk);
  return hash.digest("hex");
}

/** Throw a refusal when `path` is a symlink (or anything but a regular file). Absent is fine. */
async function refuseOddFile(path: string, what: string): Promise<void> {
  let entry;
  try {
    entry = await lstat(path);
  } catch {
    return;
  }
  if (entry.isSymbolicLink()) throw new WhistleRefusal(`a symlink is in the way of the ${what}; Collie does not follow it`);
  if (!entry.isFile()) throw new WhistleRefusal(`something that is not a file is in the way of the ${what}`);
}

export function createWhistleModelStore(deps: WhistleModelDeps): WhistleModelStore {
  const paths = whistlePaths(deps.stateDir);
  const pin = deps.pin ?? WHISTLE_MODEL;
  const accepted = deps.accepted ?? ACCEPTED_WHISTLE_SHAS;
  // The pinned size: a body that runs one byte past it cannot be the pinned model, so stop there.
  const capBytes = deps.capBytes ?? pin.bytes;
  const timeoutMs = deps.timeoutMs ?? WHISTLE_DOWNLOAD_TIMEOUT_MS;
  const fetchImpl: WhistleFetch = deps.fetch ?? ((url, init) => fetch(url, init));
  const lookupImpl: WhistleLookup = deps.lookup ?? dnsLookup;
  const now = deps.now ?? Date.now;

  /** What sits at the model's path: nothing, an accepted model, a model this build refuses, or an odd entry. */
  async function inspect(): Promise<
    | { kind: "absent" }
    | { kind: "held"; sha256: string; bytes: number; accepted: boolean }
    | { kind: "odd"; reason: string }
  > {
    let entry;
    try {
      entry = await lstat(paths.model);
    } catch {
      return { kind: "absent" };
    }
    if (entry.isSymbolicLink()) return { kind: "odd", reason: "a symlink is at the model's path; Collie does not follow it" };
    if (!entry.isFile()) return { kind: "odd", reason: "something that is not a file is at the model's path" };
    const key = `${entry.size}:${entry.mtimeMs}:${entry.ino}`;
    let cached = hashCache.get(paths.model);
    if (cached?.key !== key) {
      try {
        cached = { key, sha256: await hashFile(paths.model) };
      } catch {
        return { kind: "odd", reason: "the model on this host cannot be read" };
      }
      hashCache.set(paths.model, cached);
    }
    return { kind: "held", sha256: cached.sha256, bytes: entry.size, accepted: accepted.includes(cached.sha256) };
  }

  /**
   * The lock as it stands: its text, whether it is younger than the deadline, and the part file it
   * names. Null when there is none. A link or a folder is no lock; `prepare` refuses it by name.
   */
  async function readLock(): Promise<{ text: string; young: boolean; part: string | null; identity: string } | null> {
    let entry;
    try {
      entry = await lstat(paths.lock);
    } catch {
      return null;
    }
    if (!entry.isFile()) return null;
    let text = "";
    try {
      // A lock is a few dozen bytes; anything larger is not one of ours, and is judged by its age alone.
      if (entry.size <= 4096) text = await readFile(paths.lock, "utf8");
    } catch {
      return null;
    }
    let part: string | null = null;
    try {
      // SAFETY: `JSON.parse` answers with a JSON value; the one field read is narrowed below.
      const named = jsonStringField(jsonRecord(JSON.parse(text) as JsonValue)?.part);
      if (named !== null && PART_NAME.test(named)) part = named;
    } catch {
      /* a torn or foreign lock still counts by its age */
    }
    return { text, young: Date.now() - entry.mtimeMs < timeoutMs, part, identity: lockIdentity(entry) };
  }


  /** A download by another process: a lock younger than the deadline. Its part file's size is what it received. */
  async function runningElsewhere(): Promise<{ received: number } | null> {
    const lock = await readLock();
    if (lock === null || !lock.young) return null;
    let received = 0;
    if (lock.part !== null) {
      try {
        const entry = await lstat(join(paths.dir, lock.part));
        if (entry.isFile()) received = entry.size;
      } catch {
        /* not made yet, or already renamed into place */
      }
    }
    return { received };
  }

  /** Remove the lock, but only while it still holds `text`: never a lock another process just took. */
  async function releaseLock(text: string): Promise<void> {
    try {
      if ((await readFile(paths.lock, "utf8")) === text) await rm(paths.lock, { force: true });
    } catch {
      /* gone already */
    }
  }

  /**
   * Remove what dead downloads left: a stale lock (only while it is still the file judged stale),
   * and every part file and manifest temporary except the part a live lock names. With a
   * live lock, the manifest temporaries are left alone too: that download may be writing one.
   */
  async function sweep(): Promise<void> {
    const lock = await readLock();
    if (lock !== null && !lock.young) {
      // The same file that was judged stale, not one another process made since.
      const current = await lstat(paths.lock).catch(() => null);
      if (current !== null && lockIdentity(current) === lock.identity) await rm(paths.lock, { force: true }).catch(() => undefined);
    }
    const live = lock !== null && lock.young;
    let names: string[];
    try {
      names = await readdir(paths.dir);
    } catch {
      return;
    }
    for (const name of names) {
      const stale = (PART_NAME.test(name) && !(live && name === lock.part)) || (!live && MANIFEST_TEMP_NAME.test(name));
      // `rm` on a symlink removes the link, never its target.
      if (stale) await rm(join(paths.dir, name), { force: true }).catch(() => undefined);
    }
  }

  /** What `collie stt status` and `doctor` say about the model, with more detail than the route needs. */
  async function describe(): Promise<WhistleDescription> {
    const flight = inFlight.get(paths.dir);
    if (flight !== undefined) return { kind: "downloading", received: flight.received };
    const held = await inspect();
    if (held.kind === "odd") return { kind: "unreadable", reason: held.reason };
    if (held.kind === "held") {
      if (!held.accepted) return { kind: "mismatch", sha256: held.sha256, bytes: held.bytes };
      return { kind: "ready", sha256: held.sha256, bytes: held.bytes, revision: (await readManifest())?.model.revision ?? null };
    }
    const other = await runningElsewhere();
    return other === null ? { kind: "absent" } : { kind: "downloading", received: other.received };
  }

  async function readManifest(): Promise<WhistleManifest | null> {
    try {
      // SAFETY: only ever written by this module, and every reader treats a missing field as absent.
      return JSON.parse(await readFile(paths.manifest, "utf8")) as WhistleManifest;
    } catch {
      return null;
    }
  }

  /**
   * The revision and fetch time for the Settings page, from the manifest, and only when the manifest
   * describes THE FILE THAT IS HELD (same hash). Both reach a URL and a date in the browser, so each is
   * checked for shape here rather than trusted: a hand-edited or stale manifest yields no field at all.
   */
  function provenance(manifest: WhistleManifest | null, sha256: string): Pick<WhistleModelStatus, "revision" | "fetchedAt"> {
    const model = manifest?.model;
    if (model === undefined || model.sha256 !== sha256) return {};
    const out: Pick<WhistleModelStatus, "revision" | "fetchedAt"> = {};
    const revision = PLAIN_REVISION.exec(String(model.revision))?.[0];
    if (revision !== undefined) out.revision = revision;
    const at = new Date(String(model.fetchedAt));
    if (!Number.isNaN(at.getTime())) out.fetchedAt = at.toISOString();
    return out;
  }

  async function status(): Promise<WhistleModelStatus> {
    const flight = inFlight.get(paths.dir);
    if (flight !== undefined) return { state: "downloading", bytes: pin.bytes, received: flight.received };
    const held = await inspect();
    if (held.kind === "held" && held.accepted) {
      return { state: "ready", bytes: pin.bytes, sha256: held.sha256, ...provenance(await readManifest(), held.sha256) };
    }
    const other = await runningElsewhere();
    if (other !== null) return { state: "downloading", bytes: pin.bytes, received: other.received };
    if (held.kind === "held") {
      return { state: "failed", bytes: pin.bytes, reason: "the model on this host is not one this version of Collie accepts; set it up again" };
    }
    if (held.kind === "odd") return { state: "failed", bytes: pin.bytes, reason: held.reason };
    const failure = lastFailure.get(paths.dir);
    if (failure !== undefined) return { state: "failed", bytes: pin.bytes, reason: failure };
    return { state: "absent", bytes: pin.bytes };
  }

  /**
   * The folder, 0700, with nothing odd in it, the lock created exclusively, and this download's own
   * part file. Throws a refusal, or {@link WhistleRunning}.
   */
  async function prepare(): Promise<Prepared> {
    try {
      await mkdir(paths.dir, { recursive: true, mode: 0o700 });
    } catch {
      throw new WhistleRefusal("the model's folder could not be made in the state dir");
    }
    // `mkdir -p` follows a symlinked folder; lstat catches it afterwards. The state dir itself is
    // the operator's to place where they like, so it is not checked.
    const entry = await lstat(paths.dir);
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      throw new WhistleRefusal("the model's folder in the state dir is a symlink or not a folder; Collie does not follow it");
    }
    await chmod(paths.dir, 0o700);
    await refuseOddFile(paths.model, "model");
    await refuseOddFile(paths.manifest, "model's manifest");
    await refuseOddFile(paths.lock, "download's lock");
    // A lock this young is another process's download. An older one is a crash's: start over.
    if ((await runningElsewhere()) !== null) throw new WhistleRunning();
    await sweep();
    // `wx`, and BEFORE the request, so the lock exists while the connection is being made. Created
    // here or not at all: nothing put at this path in the meantime is written through, and a second
    // downloader's `wx` fails. It names the part file before that file exists.
    const part = whistlePartName(process.pid, ++writeSeq);
    const lockText = `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), part })}\n`;
    let lock: FileHandle;
    try {
      lock = await open(paths.lock, "wx", 0o600);
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code === "EEXIST") throw new WhistleRunning();
      throw err;
    }
    try {
      await lock.writeFile(lockText);
    } catch (err) {
      // The file is this process's own, just made: a lock that says nothing must not block the next.
      await lock.close().catch(() => undefined);
      await rm(paths.lock, { force: true }).catch(() => undefined);
      throw err;
    }
    await lock.close();
    try {
      return { file: await open(join(paths.dir, part), "wx", 0o600), part, lockText };
    } catch (err) {
      await releaseLock(lockText);
      throw err;
    }
  }

  /** Refuse a hop that is not `https:`, or whose host is, or resolves to, an address not public. */
  async function checkHop(url: URL, signal: AbortSignal): Promise<void> {
    if (url.protocol !== "https:") throw new WhistleRefusal("the download was sent to an address that is not https");
    // `URL` has already turned `0x7f.1` and `2130706433` into dotted IPv4; IPv6 keeps its brackets.
    const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
    const local = (): WhistleRefusal => new WhistleRefusal("the download was sent to a local or private address");
    if (host === "localhost" || host.endsWith(".localhost")) throw local();
    if (isIP(host) !== 0) {
      if (!isPublicAddress(host)) throw local();
      return;
    }
    let addresses: readonly string[];
    try {
      // Raced with the deadline: a resolver that never answers must not outlive the download.
      addresses = await new Promise<readonly string[]>((resolve, reject) => {
        const stop = (): void => reject(new Error("aborted"));
        if (signal.aborted) stop();
        signal.addEventListener("abort", stop, { once: true });
        lookupImpl(host)
          .then(resolve, reject)
          .finally(() => signal.removeEventListener("abort", stop));
      });
    } catch {
      throw new WhistleRefusal(signal.aborted ? "the download took too long" : "the download could not reach Hugging Face");
    }
    if (addresses.length === 0 || !addresses.every(isPublicAddress)) throw local();
  }

  /** The pinned URL's answer, its redirects followed by hand under {@link checkHop}. Throws a refusal. */
  async function fetchPinned(signal: AbortSignal): Promise<Response> {
    let url = new URL(pin.url);
    for (let hop = 0; ; hop++) {
      await checkHop(url, signal);
      let res: Response;
      try {
        res = await fetchImpl(url.href, {
          redirect: "manual",
          headers: { "user-agent": `Collie/${deps.version}`, accept: "application/octet-stream" },
          signal,
        });
      } catch {
        throw new WhistleRefusal(signal.aborted ? "the download took too long" : "the download could not reach Hugging Face");
      }
      if (!REDIRECTS.has(res.status)) return res;
      await res.body?.cancel().catch(() => undefined);
      if (hop >= WHISTLE_MAX_REDIRECTS) throw new WhistleRefusal("the download was redirected too many times");
      const location = res.headers.get("location");
      try {
        if (location === null) throw new Error("no location");
        url = new URL(location, url);
      } catch {
        throw new WhistleRefusal(`the download answered HTTP ${res.status} with no usable address`);
      }
    }
  }

  /** Fetch, stream, hash, rename. Throws a refusal with the reason to record. */
  async function download(flight: InFlight, { file, part }: Prepared): Promise<void> {
    const signal = AbortSignal.any([flight.controller.signal, AbortSignal.timeout(timeoutMs)]);
    const hash = createHash("sha256");
    try {
      const res = await fetchPinned(signal);
      if (!res.ok || res.body === null) {
        await res.body?.cancel().catch(() => undefined);
        throw new WhistleRefusal(`the download answered HTTP ${res.status}`);
      }
      const declared = Number(res.headers.get("content-length") ?? "");
      if (Number.isFinite(declared) && declared > capBytes) {
        await res.body.cancel().catch(() => undefined);
        throw new WhistleRefusal(`the download is larger than ${capBytes} bytes`);
      }
      const reader = res.body.getReader();
      for (;;) {
        let chunk: Awaited<ReturnType<typeof reader.read>>;
        try {
          chunk = await reader.read();
        } catch {
          throw new WhistleRefusal(signal.aborted ? "the download took too long" : "the download broke off");
        }
        if (chunk.done) break;
        flight.received += chunk.value.byteLength;
        if (flight.received > capBytes) {
          await reader.cancel().catch(() => undefined);
          throw new WhistleRefusal(`the download is larger than ${capBytes} bytes`);
        }
        hash.update(chunk.value);
        await file.write(chunk.value);
      }
    } finally {
      await file.close();
    }

    await finalize(part, hash.digest("hex"), flight.received, pin.url, "download");
  }

  /**
   * The hash gate, then the rename and the manifest. The part file is complete and closed. Nothing
   * reaches the model's path unless its hash is the pin: a mismatch throws with both hashes.
   */
  async function finalize(part: string, sha256: string, bytes: number, source: string, what: "download" | "file"): Promise<void> {
    if (sha256 !== pin.sha256 || !accepted.includes(sha256)) {
      throw new WhistleRefusal(`the ${what} did not match the pinned model (got ${sha256}, expected ${pin.sha256})`);
    }
    await refuseOddFile(paths.model, "model");
    const partPath = join(paths.dir, part);
    await chmod(partPath, 0o600);
    // This download's own part file, and no other: a second downloader's file is never renamed here.
    await rename(partPath, paths.model);
    const manifest: WhistleManifest = {
      version: 1,
      model: { sha256, bytes, revision: pin.revision, source, fetchedAt: new Date(now()).toISOString() },
    };
    await refuseOddFile(paths.manifest, "model's manifest");
    // Through a temporary of this write's own, renamed over the manifest: never a shared name.
    const temporary = `${paths.manifest}.${process.pid}.${++writeSeq}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: "wx" });
      await rename(temporary, paths.manifest);
    } catch (err) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw err;
    }
  }

  /** Copy a local file into the part file through the same running hash. Throws a refusal. */
  async function copyIn(source: string, flight: InFlight, { file, part }: Prepared): Promise<void> {
    const hash = createHash("sha256");
    let input: FileHandle | null = null;
    try {
      try {
        // O_NOFOLLOW: a link swapped in after the lstat in `importFile` is refused here, not followed.
        input = await open(source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      } catch {
        throw new WhistleRefusal("the file could not be opened (a symlink, or no longer there)");
      }
      const entry = await input.stat();
      if (!entry.isFile()) throw new WhistleRefusal("that is not a regular file");
      if (entry.size > capBytes) throw new WhistleRefusal(`the file is larger than ${capBytes} bytes`);
      const buffer = new Uint8Array(1024 * 1024);
      for (;;) {
        const { bytesRead } = await input.read(buffer, 0, buffer.byteLength, null);
        if (bytesRead === 0) break;
        flight.received += bytesRead;
        if (flight.received > capBytes) throw new WhistleRefusal(`the file is larger than ${capBytes} bytes`);
        const piece = buffer.subarray(0, bytesRead);
        hash.update(piece);
        await file.write(piece);
      }
    } finally {
      await input?.close().catch(() => undefined);
      await file.close();
    }
    await finalize(part, hash.digest("hex"), flight.received, "a file the operator supplied", "file");
  }

  /** Run `fill` over a freshly locked part file as the one download in flight. See {@link WhistleModelStore.start}. */
  async function begin(fill: (flight: InFlight, prepared: Prepared) => Promise<void>): Promise<WhistleStart> {
    const joined = inFlight.get(paths.dir);
    if (joined !== undefined) return { outcome: "downloading", status: await status() };
    const held = await inspect();
    if (held.kind === "held" && held.accepted) return { outcome: "ready", status: await status() };
    // Another process is downloading: report it, fetch nothing, touch nothing of theirs.
    const other = await runningElsewhere();
    // Checked again after the awaits: a start that raced this one owns the download.
    if (inFlight.has(paths.dir)) return { outcome: "downloading", status: await status() };
    if (other !== null) return { outcome: "downloading", status: await status(), elsewhere: true };

    const flight: InFlight = { done: Promise.resolve(), received: 0, controller: new AbortController() };
    let prepared!: (refusal: string | null) => void;
    /** Set when the part file turned out to be another process's. */
    let elsewhere = false;
    const preparation = new Promise<string | null>((resolve) => {
      prepared = resolve;
    });
    flight.done = (async () => {
      let holding: Prepared | null = null;
      try {
        holding = await prepare();
        prepared(null);
        await fill(flight, holding);
        lastFailure.delete(paths.dir);
      } catch (err) {
        if (err instanceof WhistleRunning) {
          // Another process took the lock between the check and here. Theirs stays as it is.
          elsewhere = true;
          prepared(null);
          return;
        }
        const reason = err instanceof WhistleRefusal ? err.message : "the download could not be written to the state dir";
        prepared(reason);
        // This download's own part file only; after a successful rename there is none to remove.
        if (holding !== null) await rm(join(paths.dir, holding.part), { force: true }).catch(() => undefined);
        // A download stopped by `remove()` is not a failure: the person asked for nothing to be there.
        if (!flight.controller.signal.aborted) lastFailure.set(paths.dir, reason);
      } finally {
        if (holding !== null) await releaseLock(holding.lockText);
        if (inFlight.get(paths.dir) === flight) inFlight.delete(paths.dir);
      }
    })();
    inFlight.set(paths.dir, flight);
    lastFailure.delete(paths.dir);

    const refusal = await preparation;
    if (refusal !== null) {
      await flight.done;
      return { outcome: "refused", reason: refusal };
    }
    if (elsewhere) {
      await flight.done;
      return { outcome: "downloading", status: await status(), elsewhere: true };
    }
    return { outcome: "downloading", status: await status() };
  }

  /** Take a local file through the same hash gate. Refuses a symlink or a non-file before any state is touched. */
  async function importFile(source: string): Promise<WhistleStart> {
    let entry;
    try {
      entry = await lstat(source);
    } catch {
      return { outcome: "refused", reason: "that file does not exist or cannot be read" };
    }
    if (entry.isSymbolicLink()) return { outcome: "refused", reason: "that is a symlink; Collie does not follow it, so name the file itself" };
    if (!entry.isFile()) return { outcome: "refused", reason: "that is not a regular file" };
    if (entry.size > capBytes) return { outcome: "refused", reason: `that file is larger than ${capBytes} bytes` };
    return begin((flight, file) => copyIn(source, flight, file));
  }

  async function remove(): Promise<WhistleModelStatus> {
    // This process's own download is stopped, and its part file and lock go with it (`begin`).
    const flight = inFlight.get(paths.dir);
    if (flight !== undefined) {
      flight.controller.abort();
      await flight.done;
    }
    // `rm` on a symlink removes the link, never its target, so a removal needs no lstat.
    for (const path of [paths.model, paths.manifest]) await rm(path, { force: true });
    // Another process's live download keeps its lock and its part file; only a dead one's go. A link
    // at the lock's path is no lock: the link goes, never its target.
    if ((await lstat(paths.lock).catch(() => null))?.isSymbolicLink() === true) await rm(paths.lock, { force: true });
    await sweep();
    // The folder too, when nothing else is in it. `rmdir` refuses a folder that still holds anything, so
    // a file the operator put there survives, and a symlinked folder is not followed.
    await rmdir(paths.dir).catch(() => undefined);
    hashCache.delete(paths.model);
    lastFailure.delete(paths.dir);
    return status();
  }

  return {
    paths,
    status,
    async ready() {
      const held = await inspect();
      return held.kind === "held" && held.accepted ? { path: paths.model, sha256: held.sha256, bytes: held.bytes } : null;
    },
    start: () => begin(download),
    importFile,
    describe,
    remove,
    async settled() {
      await inFlight.get(paths.dir)?.done;
    },
    manifest: readManifest,
  };
}
