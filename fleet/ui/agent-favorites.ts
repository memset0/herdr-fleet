import type { JsonValue } from "../../bridge/json.ts";
import { jsonRecord, jsonStringField } from "../../bridge/stt/json.ts";

// THE RETIRED FAVOURITES RECORD, READ ONCE AND THEN DELETED.
//
// Fleet used to keep its own browser-local favourites beside Collie's pins. The two said the same
// thing ("this one matters") two ways, so the star now toggles Collie's own pin and this store is
// gone. What is left is the reader a browser that still holds the old record needs, exactly once:
// the shell matches each stored favourite against a fresh snapshot, pins the live ones through
// Collie's own pin store, and removes the key. A favourite whose pane is not live is dropped,
// because a pin is keyed by the workspace the pane sits in and only a live row says that.
//
// The parser and its bounds are the retired store's, unchanged: a record it would have refused is
// refused here too, and is deleted without pinning anything.

export const AGENT_FAVORITES_STORAGE_KEY = "herdr-fleet:agent-favorites:v1";

const STORAGE_VERSION = 1;
const MAX_ENTRIES = 256;
const MAX_BYTES = 32_768;
const MAX_FIELD_LENGTH = 512;

/** One stored favourite: optional host, optional session, pane id, Agent implementation. */
export interface LegacyFavorite {
  readonly host: string | null;
  readonly session: string | null;
  readonly paneId: string;
  readonly agent: string;
}

export interface LegacyFavoriteStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

function optionalField(value: JsonValue | undefined): string | null | undefined {
  if (value === null) return null;
  const field = jsonStringField(value);
  if (field === null || field.length === 0 || field.length > MAX_FIELD_LENGTH) return undefined;
  return field;
}

function requiredField(value: JsonValue | undefined): string | null {
  const field = jsonStringField(value);
  if (field === null || field.length === 0 || field.length > MAX_FIELD_LENGTH) return null;
  return field;
}

function parseTuple(value: JsonValue): LegacyFavorite | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const host = optionalField(value[0]);
  const session = optionalField(value[1]);
  const paneId = requiredField(value[2]);
  const agent = requiredField(value[3]);
  if (host === undefined || session === undefined || paneId === null || agent === null) return null;
  return { host, session, paneId, agent };
}

/** The stored favourites, or `[]` for a record that is malformed, unsupported or oversized. */
export function parseLegacyFavorites(raw: string): LegacyFavorite[] {
  if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) return [];
  let parsed: JsonValue;
  try {
    // SAFETY: JSON.parse returns JSON primitives, arrays, or objects recursively; naming that
    // representation once lets the shared readers establish every domain field below.
    parsed = JSON.parse(raw) as JsonValue;
  } catch {
    return [];
  }
  const record = jsonRecord(parsed);
  if (
    record === null ||
    Object.keys(record).some((key) => key !== "version" && key !== "favorites") ||
    record.version !== STORAGE_VERSION ||
    !Array.isArray(record.favorites) ||
    record.favorites.length > MAX_ENTRIES
  ) {
    return [];
  }
  const out: LegacyFavorite[] = [];
  for (const value of record.favorites) {
    const favorite = parseTuple(value);
    if (favorite === null) return [];
    out.push(favorite);
  }
  return out;
}

/** What a browser still holds: `null` when there is no record to migrate at all. */
export function readLegacyFavorites(storage: LegacyFavoriteStorage | null): LegacyFavorite[] | null {
  if (storage === null) return null;
  try {
    const raw = storage.getItem(AGENT_FAVORITES_STORAGE_KEY);
    return raw === null ? null : parseLegacyFavorites(raw);
  } catch {
    return null;
  }
}

/** Remove the record. A storage that refuses is left as it is; the next page load tries again. */
export function forgetLegacyFavorites(storage: LegacyFavoriteStorage | null): void {
  try {
    storage?.removeItem(AGENT_FAVORITES_STORAGE_KEY);
  } catch {
    // Blocked or partitioned storage: nothing to do.
  }
}

/** Whether a live Agent row is the one a stored favourite named: same machine, session, pane, Agent. */
export function matchesLegacyFavorite(
  favorite: LegacyFavorite,
  row: { readonly host?: string; readonly session?: string; readonly paneId: string; readonly agent: string; readonly kind?: string },
): boolean {
  return (
    row.kind !== "shell" &&
    (row.host ?? null) === favorite.host &&
    (row.session ?? null) === favorite.session &&
    row.paneId === favorite.paneId &&
    row.agent === favorite.agent
  );
}
