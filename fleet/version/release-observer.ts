import type { JsonValue } from "../../bridge/json.ts";
import { jsonRecord, jsonStringField } from "../../bridge/stt/json.ts";

export const FLEET_RELEASE_SOURCE =
  "https://api.github.com/repos/memset0/herdr-fleet/git/matching-refs/tags/v";
export const FLEET_RELEASE_FRESH_MS = 5 * 60_000;
export const FLEET_RELEASE_RETRY_MS = 60_000;
export const FLEET_RELEASE_TIMEOUT_MS = 3_000;
const MAX_SOURCE_BYTES = 256 * 1024;

export interface FleetReleaseMajor {
  readonly major: number;
  readonly version: string;
}

export interface FleetReleaseObservation {
  readonly latest: string | null;
  readonly majors: readonly FleetReleaseMajor[];
  readonly checkedAt: number | null;
  readonly freshUntil: number | null;
  readonly freshness: "fresh" | "stale" | "unavailable";
}

interface StableVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly version: string;
}

interface SuccessfulObservation {
  readonly latest: string;
  readonly majors: readonly FleetReleaseMajor[];
  readonly checkedAt: number;
  readonly freshUntil: number;
}

export type ReleaseFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface FleetReleaseObserver {
  /**
   * Return current evidence immediately and begin one shared refresh when needed. Navigation never
   * waits for the public source; a later React Router revalidation observes the settled result.
   */
  observe(): FleetReleaseObservation;
}

function stableVersion(ref: JsonValue): StableVersion | null {
  const record = jsonRecord(ref);
  if (record === null) return null;
  const name = jsonStringField(record.ref);
  const object = jsonRecord(record.object);
  if (name === null || object === null) return null;
  // GitHub names an annotated tag by a `tag` object. A lightweight tag points straight at a commit
  // and is deliberately not publication evidence even when its name looks formal.
  if (object.type !== "tag") return null;
  const match = /^refs\/tags\/v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(name);
  if (match === null) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (![major, minor, patch].every(Number.isSafeInteger)) return null;
  return { major, minor, patch, version: `${major}.${minor}.${patch}` };
}

function compareVersion(left: StableVersion, right: StableVersion): number {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

/** Select the numerically greatest annotated stable tag overall and within each major. */
export function selectFleetStableReleases(value: JsonValue): {
  latest: string | null;
  majors: readonly FleetReleaseMajor[];
} | null {
  if (!Array.isArray(value)) return null;
  const greatestByMajor = new Map<number, StableVersion>();
  let latest: StableVersion | null = null;
  for (const candidate of value) {
    const version = stableVersion(candidate);
    if (version === null) continue;
    const inMajor = greatestByMajor.get(version.major);
    if (inMajor === undefined || compareVersion(version, inMajor) > 0) {
      greatestByMajor.set(version.major, version);
    }
    if (latest === null || compareVersion(version, latest) > 0) latest = version;
  }
  const majors = [...greatestByMajor.values()]
    .toSorted((left, right) => left.major - right.major)
    .map(({ major, version }) => ({ major, version }));
  return { latest: latest?.version ?? null, majors };
}

async function readJsonWithin(response: Response): Promise<JsonValue> {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_SOURCE_BYTES) throw new Error("Fleet release source response too large");
  if (response.body === null) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error("Fleet release source response too large");
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  // SAFETY: JSON.parse produces a JsonValue; the release selector validates its records and fields.
  return JSON.parse(new TextDecoder().decode(bytes)) as JsonValue;
}

function view(success: SuccessfulObservation | null, at: number): FleetReleaseObservation {
  if (success === null) {
    return { latest: null, majors: [], checkedAt: null, freshUntil: null, freshness: "unavailable" };
  }
  return {
    latest: success.latest,
    majors: success.majors,
    checkedAt: success.checkedAt,
    freshUntil: success.freshUntil,
    freshness: at < success.freshUntil ? "fresh" : "stale",
  };
}

/**
 * One Gateway-process observation boundary. Callers share both the retained success and any request
 * already in flight; failures are retried only after a short floor and never erase evidence.
 */
export function createFleetReleaseObserver(options: {
  readonly fetcher?: ReleaseFetcher;
  readonly now?: () => number;
  readonly freshMs?: number;
  readonly retryMs?: number;
  readonly timeoutMs?: number;
} = {}): FleetReleaseObserver {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const freshMs = options.freshMs ?? FLEET_RELEASE_FRESH_MS;
  const retryMs = options.retryMs ?? FLEET_RELEASE_RETRY_MS;
  const timeoutMs = options.timeoutMs ?? FLEET_RELEASE_TIMEOUT_MS;
  let retained: SuccessfulObservation | null = null;
  let retryAt = 0;
  let inFlight: Promise<void> | null = null;

  const load = async (): Promise<void> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(FLEET_RELEASE_SOURCE, {
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": "herdr-fleet-version-observer",
          "x-github-api-version": "2022-11-28",
        },
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Fleet release source returned ${response.status}`);
      const selected = selectFleetStableReleases(await readJsonWithin(response));
      if (selected === null || selected.latest === null) {
        throw new Error("Fleet release source returned no stable annotated tag");
      }
      const checkedAt = now();
      retained = {
        latest: selected.latest,
        majors: selected.majors,
        checkedAt,
        freshUntil: checkedAt + freshMs,
      };
      retryAt = retained.freshUntil;
      return;
    } catch {
      retryAt = now() + retryMs;
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    observe(): FleetReleaseObservation {
      const at = now();
      const current = view(retained, at);
      if (retained !== null && at < retained.freshUntil) return current;
      if (at < retryAt || inFlight !== null) return current;
      inFlight = load().finally(() => {
        inFlight = null;
      });
      return current;
    },
  };
}
