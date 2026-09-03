import { deriveMode } from "../bridge/pack/mode.ts";
import {
  enrollmentOf,
  TrustStore,
  type TrustStoreData,
} from "../bridge/pack/trust-store.ts";
import type { FleetConfig, FleetNativePackConfig, FleetSchema2LeadConfig } from "./config.ts";

export type PackTrustReader = () => Promise<TrustStoreData | null>;

function productionReader(stateDir: string): PackTrustReader {
  const store = new TrustStore(stateDir);
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
