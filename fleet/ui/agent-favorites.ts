import type { JsonValue } from "../../bridge/json.ts";
import { jsonRecord, jsonStringField } from "../../bridge/stt/json.ts";

export const AGENT_FAVORITES_STORAGE_KEY = "herdr-fleet:agent-favorites:v1";

const STORAGE_VERSION = 1;
const DEFAULT_MAX_ENTRIES = 256;
const DEFAULT_MAX_BYTES = 32_768;
const DEFAULT_MAX_FIELD_LENGTH = 512;

export interface FavoriteAgentIdentity {
  readonly host?: string;
  readonly session?: string;
  readonly paneId: string;
  readonly agent: string;
  readonly kind?: "agent" | "shell";
}

export interface FavoriteStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AgentFavoriteStore {
  readonly isFavorite: (agent: FavoriteAgentIdentity) => boolean;
  readonly toggle: (agent: FavoriteAgentIdentity) => boolean;
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => number;
  readonly reset: () => void;
}

interface FavoriteStoreOptions {
  readonly maxEntries?: number;
  readonly maxBytes?: number;
  readonly maxFieldLength?: number;
}

type FavoriteTuple = readonly [string | null, string | null, string, string];

interface FavoriteDocument {
  readonly version: 1;
  readonly favorites: FavoriteTuple[];
}

function tuple(agent: FavoriteAgentIdentity): FavoriteTuple | null {
  if (agent.kind === "shell" || agent.paneId === "" || agent.agent === "") return null;
  return [agent.host ?? null, agent.session ?? null, agent.paneId, agent.agent];
}

function keyOf(agent: FavoriteAgentIdentity): string | null {
  const identity = tuple(agent);
  return identity === null ? null : JSON.stringify(identity);
}

function optionalIdentityField(value: JsonValue | undefined, maximum: number): string | null | undefined {
  if (value === null) return null;
  const field = jsonStringField(value);
  if (field === null || field.length === 0 || field.length > maximum) return undefined;
  return field;
}

function requiredIdentityField(value: JsonValue | undefined, maximum: number): string | null {
  const field = jsonStringField(value);
  if (field === null || field.length === 0 || field.length > maximum) return null;
  return field;
}

function parseTuple(value: JsonValue, maximum: number): FavoriteTuple | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const host = optionalIdentityField(value[0], maximum);
  const session = optionalIdentityField(value[1], maximum);
  const paneId = requiredIdentityField(value[2], maximum);
  const agent = requiredIdentityField(value[3], maximum);
  if (host === undefined || session === undefined || paneId === null || agent === null) return null;
  return [host, session, paneId, agent];
}

function parseDocument(
  raw: string,
  maxEntries: number,
  maxBytes: number,
  maxFieldLength: number,
): FavoriteDocument | null {
  if (new TextEncoder().encode(raw).byteLength > maxBytes) return null;
  let parsed: JsonValue;
  try {
    // SAFETY: JSON.parse returns JSON primitives, arrays, or objects recursively; naming that
    // representation once lets the shared readers establish every domain field below.
    parsed = JSON.parse(raw) as JsonValue;
  } catch {
    return null;
  }
  const record = jsonRecord(parsed);
  if (record === null) return null;
  if (
    Object.keys(record).some((key) => key !== "version" && key !== "favorites") ||
    record.version !== STORAGE_VERSION ||
    !Array.isArray(record.favorites) ||
    record.favorites.length > maxEntries
  ) {
    return null;
  }
  const favorites: FavoriteTuple[] = [];
  const seen = new Set<string>();
  for (const value of record.favorites) {
    const identity = parseTuple(value, maxFieldLength);
    if (identity === null) return null;
    const key = JSON.stringify(identity);
    if (seen.has(key)) return null;
    seen.add(key);
    favorites.push(identity);
  }
  return { version: STORAGE_VERSION, favorites };
}

function browserStorage(): FavoriteStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function favoriteFirst<T>(items: readonly T[], isFavorite: (item: T) => boolean): T[] {
  const favorites: T[] = [];
  const others: T[] = [];
  for (const item of items) (isFavorite(item) ? favorites : others).push(item);
  return [...favorites, ...others];
}

export function createAgentFavoriteStore(
  storage: FavoriteStorage | null = browserStorage(),
  options: FavoriteStoreOptions = {},
): AgentFavoriteStore {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxFieldLength = options.maxFieldLength ?? DEFAULT_MAX_FIELD_LENGTH;
  if (maxEntries < 1 || maxBytes < 1 || maxFieldLength < 1) {
    throw new Error("favorite store bounds must be positive");
  }

  let favorites = new Map<string, FavoriteTuple>();
  if (storage !== null) {
    try {
      const raw = storage.getItem(AGENT_FAVORITES_STORAGE_KEY);
      const document =
        raw === null ? null : parseDocument(raw, maxEntries, maxBytes, maxFieldLength);
      if (document !== null) {
        favorites = new Map(document.favorites.map((identity) => [JSON.stringify(identity), identity]));
      }
    } catch {
      favorites = new Map();
    }
  }

  let revision = 0;
  const listeners = new Set<() => void>();

  const serialize = () => {
    const document: FavoriteDocument = {
      version: STORAGE_VERSION,
      favorites: [...favorites.values()],
    };
    return JSON.stringify(document);
  };

  const persist = () => {
    if (storage === null) return;
    try {
      storage.setItem(AGENT_FAVORITES_STORAGE_KEY, serialize());
    } catch {
      // The bounded in-memory state remains authoritative for this page.
    }
  };

  const publish = () => {
    revision += 1;
    for (const listener of listeners) listener();
  };

  const isFavorite = (agent: FavoriteAgentIdentity) => {
    const key = keyOf(agent);
    return key !== null && favorites.has(key);
  };

  const toggle = (agent: FavoriteAgentIdentity) => {
    const identity = tuple(agent);
    if (identity === null) return false;
    const key = JSON.stringify(identity);
    if (favorites.delete(key)) {
      persist();
      publish();
      return false;
    }
    if (favorites.size >= maxEntries) {
      const oldest = favorites.keys().next();
      if (!oldest.done) favorites.delete(oldest.value);
    }
    favorites.set(key, identity);
    while (new TextEncoder().encode(serialize()).byteLength > maxBytes) {
      const oldest = favorites.keys().next();
      if (oldest.done) break;
      favorites.delete(oldest.value);
    }
    persist();
    publish();
    return favorites.has(key);
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const reset = () => {
    favorites = new Map();
    publish();
  };

  return { isFavorite, toggle, subscribe, snapshot: () => revision, reset };
}

export const agentFavoriteStore = createAgentFavoriteStore();

export function __resetAgentFavorites(): void {
  agentFavoriteStore.reset();
}
