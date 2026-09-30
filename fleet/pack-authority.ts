import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { deriveMode } from "../bridge/crew/mode.ts";
import { crewStateFileMoves } from "../bridge/crew/state-migration.ts";
import {
  enrollmentOf,
  TRUST_STORE_FILENAME,
  TrustStore,
  type TrustStoreData,
  type TrustStoreIo,
} from "../bridge/crew/trust-store.ts";
import type { FleetConfig, FleetNativePackConfig, FleetSchema2LeadConfig } from "./config.ts";

export type PackTrustReader = () => Promise<TrustStoreData | null>;

/** Read a file, or `null` when it does not exist. Any other error propagates. */
async function readIfPresent(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") return null;
    throw err;
  }
}

/**
 * The trust file's previous name, taken from Collie's own move table rather than typed here.
 *
 * REMOVE_IN_1_9_0 — with Collie's own one-time move.
 */
function legacyTrustStoreFilename(): string | null {
  return crewStateFileMoves().find((move) => move.current === TRUST_STORE_FILENAME)?.legacy ?? null;
}

/**
 * A read-only view of Collie's state directory for its own `TrustStore`.
 *
 * WHY NOT COLLIE'S DEFAULT IO. The adopted Collie's filesystem io runs its one-time `pack-*` → `crew-*`
 * rename before every read. Fleet validates authority before Collie has started, so reading through
 * that io would make this runtime the thing that renames the operator's trust state — which the
 * authority boundary forbids. This io never renames and never writes.
 *
 * WHY THE FALLBACK. On the first start after the upgrade only the previous name exists, because the
 * rename is Collie's own act at its own start. Refusing then would fail closed for ever: Collie would
 * never start to perform it. So while the current name is absent the previous one is read — through
 * the same reader and parser — and left exactly where and as it is. The current name wins when both
 * exist, as it does in Collie.
 */
export function readOnlyTrustStoreIo(stateDir: string): TrustStoreIo {
  const legacy = legacyTrustStoreFilename();
  return {
    async read(path) {
      const current = await readIfPresent(path);
      if (current !== null || legacy === null) return current;
      return readIfPresent(join(stateDir, legacy));
    },
    async write() {
      throw new Error("Fleet never writes Collie trust state");
    },
  };
}

function productionReader(stateDir: string): PackTrustReader {
  const store = new TrustStore(stateDir, readOnlyTrustStoreIo(stateDir));
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
