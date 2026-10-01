import { readFile } from "node:fs/promises";

import { deriveMode } from "../bridge/crew/mode.ts";
import {
  enrollmentOf,
  fsStateFilePresence,
  legacyStateFileNotice,
  TrustStore,
  trustStorePath,
  type StateFilePresence,
  type TrustStoreData,
  type TrustStoreIo,
} from "../bridge/crew/trust-store.ts";
import type { JsonValue } from "../bridge/json.ts";
import type { FleetConfig, FleetNativePackConfig, FleetSchema2LeadConfig } from "./config.ts";

export type PackTrustReader = () => Promise<TrustStoreData | null>;

/**
 * Refuse a state directory that holds only 1.7.0's trust-state name, with Collie's own notice.
 *
 * The adopted Collie neither moves nor reads that name; started against such a directory it would
 * print this same notice and run solo. Fleet says it first and starts nothing, and both the file and
 * its name stay exactly as they are — the hand edits the notice names are the operator's.
 */
export function assertNoLegacyOnlyTrustState(
  stateDir: string,
  presence: StateFilePresence = fsStateFilePresence,
): void {
  const notice = legacyStateFileNotice(stateDir, presence);
  if (notice !== null) throw new Error(notice);
}

/**
 * A read-only view of Collie's state directory for its own `TrustStore`.
 *
 * Collie's default io no longer renames anything on read, but Fleet validates authority before Collie
 * has started, and the guarantee that this runtime never writes trust state stays mechanical here
 * rather than depending on upstream keeping `read()` side-effect free. It reads the current name only
 * and refuses every write.
 */
export function readOnlyTrustStoreIo(): TrustStoreIo {
  return {
    async read(path) {
      try {
        return await readFile(path, "utf8");
      } catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") return null;
        throw err;
      }
    },
    async write() {
      throw new Error("Fleet never writes Collie trust state");
    },
  };
}

/**
 * The line to print when the trust store is in the pre-Collie-1.9 inner shape, or `null` when not.
 *
 * Collie 1.9 and later read the crew identity from the top-level `crew` key only, and parse a
 * document without it as a valid store holding no crew. A store a 1.8-era peer never rewrote still
 * spells that key `pack`: it derives Peer mode from its lead record, starts, and then refuses its own
 * lead, because it holds no crew secret. So the shape is decided here from the raw document, by key
 * presence alone — `pack` without `crew` refuses, `crew` with or without a stray `pack` proceeds — and
 * the line names keys and never a value. A missing, unreadable, unparseable or non-object document is
 * not this check's to decide; it falls through to the ordinary absent-or-invalid handling.
 */
export async function preCrewTrustStoreNotice(
  stateDir: string,
  io: TrustStoreIo = readOnlyTrustStoreIo(),
): Promise<string | null> {
  const path = trustStorePath(stateDir);
  let raw: string | null;
  try {
    raw = await io.read(path);
  } catch {
    return null;
  }
  if (raw === null) return null;
  let parsed: JsonValue;
  try {
    // SAFETY: `JSON.parse` output IS a JsonValue by construction; only its top-level keys are read.
    parsed = JSON.parse(raw) as JsonValue;
  } catch {
    return null;
  }
  if (parsed === null || Array.isArray(parsed) || !(parsed instanceof Object)) return null;
  if (!Object.hasOwn(parsed, "pack") || Object.hasOwn(parsed, "crew")) return null;
  return (
    `[fleet] ${path} is a trust store in the pre-Collie-1.9 shape: it has the top-level key "pack" ` +
    `and no "crew", so this release would read it as holding no crew. Fleet has started nothing and ` +
    `changed nothing. Rewrite the store with this member's previous Fleet release (3.4.x) — its own ` +
    `trust-store no-op commit writes the current shape — then run this release.`
  );
}

/** Refuse a pack-shaped trust store before anything reads it as a store with no crew. */
export async function assertNoPreCrewTrustStore(stateDir: string): Promise<void> {
  const notice = await preCrewTrustStoreNotice(stateDir);
  if (notice !== null) throw new Error(notice);
}

function productionReader(stateDir: string): PackTrustReader {
  const store = new TrustStore(stateDir, readOnlyTrustStoreIo());
  return () => store.load();
}

export function usesNativePack(config: FleetConfig): config is FleetNativePackConfig {
  return config.schemaVersion === 2;
}

export async function validatePackAuthority(
  config: FleetConfig,
  collieStateDir: string,
  readTrust: PackTrustReader = productionReader(collieStateDir),
): Promise<void> {
  if (!usesNativePack(config)) return;
  assertNoLegacyOnlyTrustState(collieStateDir);
  await assertNoPreCrewTrustStore(collieStateDir);
  let trust: TrustStoreData | null;
  try {
    trust = await readTrust();
  } catch {
    throw new Error("Collie Pack trust state is unavailable or invalid");
  }
  if (trust === null) throw new Error("Collie Pack trust state is unavailable or invalid");
  const enrollment = enrollmentOf(trust);
  const resolved = deriveMode(enrollment);
  if (resolved.conflict !== null) throw new Error("Collie Pack trust state is conflicted");
  if (resolved.mode === "solo") throw new Error("Collie Pack trust state does not contain an active Pack role");
  if (resolved.mode !== config.role) {
    throw new Error(`fleet.toml role ${config.role} does not match Collie Pack role ${resolved.mode}`);
  }
  if (config.role === "lead") assertReachabilityMatchesRoster(config, enrollment?.peers ?? []);
}

/**
 * A Lead's reachability list projects the membership Collie already owns; it never defines it.
 *
 * Set equality is the whole check. A member Collie enrolled but the mapping omits is one the Lead
 * believes in and cannot dial, and a mapping row Collie never enrolled is configuration trying to be
 * a second roster — both fail startup rather than being reconciled here, because reconciling would
 * mean deciding membership outside the trust store.
 */
function assertReachabilityMatchesRoster(
  config: FleetSchema2LeadConfig,
  peers: readonly { readonly memberId: string }[],
): void {
  const enrolled = new Set(peers.map((peer) => peer.memberId));
  const mapped = new Set(config.reachability.map((entry) => entry.memberId));
  const unmapped = [...enrolled].filter((memberId) => !mapped.has(memberId)).toSorted();
  const unknown = [...mapped].filter((memberId) => !enrolled.has(memberId)).toSorted();
  if (unmapped.length > 0) {
    throw new Error(`Collie Pack member ${unmapped[0]} has no fleet.toml reachability entry`);
  }
  if (unknown.length > 0) {
    throw new Error(`fleet.toml reachability names ${unknown[0]}, which Collie has not enrolled`);
  }
}
