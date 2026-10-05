import type { BindingPlace } from "./place.ts";

export const LEGACY_PIN_BACKUP = "fleet:terminal-pins:legacy-backup:v1";
interface BackupStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Recovery data only, never a second source for favorite state and never sent to the server. */
export function preserveLegacyPins(records: readonly BindingPlace[], storage: BackupStorage | null): boolean {
  if (!storage) return false;
  try {
    if (storage.getItem(LEGACY_PIN_BACKUP) === null) storage.setItem(LEGACY_PIN_BACKUP, JSON.stringify(records));
    return true;
  } catch { return false; }
}
