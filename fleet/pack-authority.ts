import { deriveMode } from "../bridge/pack/mode.ts";
import {
  enrollmentOf,
  TrustStore,
  type TrustStoreData,
} from "../bridge/pack/trust-store.ts";
import type { FleetConfig, FleetNativePackConfig } from "./config.ts";

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
  const resolved = deriveMode(enrollmentOf(trust));
  if (resolved.conflict !== null) throw new Error("Collie Pack trust state is conflicted");
  if (resolved.mode === "solo") throw new Error("Collie Pack trust state does not contain an active Pack role");
  if (resolved.mode !== config.role) {
    throw new Error(`fleet.toml role ${config.role} does not match Collie Pack role ${resolved.mode}`);
  }
}
