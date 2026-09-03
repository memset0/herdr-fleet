import { describe, expect, test } from "bun:test";

import {
  AGENT_FAVORITES_STORAGE_KEY,
  createAgentFavoriteStore,
  favoriteFirst,
  type FavoriteAgentIdentity,
  type FavoriteStorage,
} from "./agent-favorites.ts";

class MemoryStorage implements FavoriteStorage {
  value: string | null = null;
  throwRead = false;
  throwWrite = false;

  getItem(key: string): string | null {
    expect(key).toBe(AGENT_FAVORITES_STORAGE_KEY);
    if (this.throwRead) throw new Error("read blocked");
    return this.value;
  }

  setItem(key: string, value: string): void {
    expect(key).toBe(AGENT_FAVORITES_STORAGE_KEY);
    if (this.throwWrite) throw new Error("write blocked");
    this.value = value;
  }
}

const agent = (over: Partial<FavoriteAgentIdentity> = {}): FavoriteAgentIdentity => ({
  paneId: "w1:p1",
  agent: "claude",
  ...over,
});

describe("Agent favorite identity and storage", () => {
  test("separates host, session, pane, and implementation while ignoring presentation fields", () => {
    const store = createAgentFavoriteStore(null);
    expect(store.toggle(agent({ host: "lead", session: "work" }))).toBeTrue();
    expect(store.isFavorite(agent({ host: "lead", session: "work" }))).toBeTrue();
    expect(store.isFavorite(agent({ host: "peer", session: "work" }))).toBeFalse();
    expect(store.isFavorite(agent({ host: "lead", session: "other" }))).toBeFalse();
    expect(store.isFavorite(agent({ host: "lead", session: "work", paneId: "w1:p2" }))).toBeFalse();
    expect(store.isFavorite(agent({ host: "lead", session: "work", agent: "codex" }))).toBeFalse();
  });

  test("persists valid tuples and restores them in insertion order", () => {
    const storage = new MemoryStorage();
    const first = createAgentFavoriteStore(storage);
    first.toggle(agent({ paneId: "p1" }));
    first.toggle(agent({ paneId: "p2" }));

    const restored = createAgentFavoriteStore(storage);
    expect(restored.isFavorite(agent({ paneId: "p1" }))).toBeTrue();
    expect(restored.isFavorite(agent({ paneId: "p2" }))).toBeTrue();
  });

  test("rejects malformed, unsupported, oversized, duplicate, and over-capacity records", () => {
    const storage = new MemoryStorage();
    for (const value of [
      "not-json",
      JSON.stringify({ version: 2, favorites: [] }),
      JSON.stringify({ version: 1, favorites: [[null, null, "", "claude"]] }),
      JSON.stringify({ version: 1, favorites: [[null, null, "p", "claude"], [null, null, "p", "claude"]] }),
      JSON.stringify({ version: 1, favorites: [[null, null, "p1", "claude"], [null, null, "p2", "claude"]] }),
      "x".repeat(129),
    ]) {
      storage.value = value;
      const store = createAgentFavoriteStore(storage, { maxEntries: 1, maxBytes: 128, maxFieldLength: 16 });
      expect(store.isFavorite(agent({ paneId: "p1" }))).toBeFalse();
    }
  });

  test("evicts the oldest identity at capacity", () => {
    const store = createAgentFavoriteStore(null, { maxEntries: 2 });
    store.toggle(agent({ paneId: "p1" }));
    store.toggle(agent({ paneId: "p2" }));
    store.toggle(agent({ paneId: "p3" }));
    expect(store.isFavorite(agent({ paneId: "p1" }))).toBeFalse();
    expect(store.isFavorite(agent({ paneId: "p2" }))).toBeTrue();
    expect(store.isFavorite(agent({ paneId: "p3" }))).toBeTrue();
  });

  test("evicts oldest identities until the serialized record fits the byte bound", () => {
    const storage = new MemoryStorage();
    const store = createAgentFavoriteStore(storage, { maxEntries: 4, maxBytes: 80 });
    store.toggle(agent({ paneId: "first" }));
    expect(store.toggle(agent({ paneId: "second" }))).toBeTrue();
    expect(new TextEncoder().encode(storage.value ?? "").byteLength).toBeLessThanOrEqual(80);
    expect(store.isFavorite(agent({ paneId: "first" }))).toBeFalse();
    expect(store.isFavorite(agent({ paneId: "second" }))).toBeTrue();
  });

  test("keeps bounded in-memory continuity when storage throws", () => {
    const storage = new MemoryStorage();
    storage.throwRead = true;
    const store = createAgentFavoriteStore(storage);
    storage.throwRead = false;
    storage.throwWrite = true;
    expect(store.toggle(agent())).toBeTrue();
    expect(store.isFavorite(agent())).toBeTrue();
    expect(store.toggle(agent())).toBeFalse();
    expect(store.isFavorite(agent())).toBeFalse();
  });

  test("never favorites shell rows", () => {
    const store = createAgentFavoriteStore(null);
    expect(store.toggle(agent({ kind: "shell" }))).toBeFalse();
    expect(store.isFavorite(agent({ kind: "shell" }))).toBeFalse();
  });
});

describe("favorite-first partition", () => {
  test("keeps the input order stable inside both partitions", () => {
    const items = ["favorite-old", "plain-new", "favorite-new", "plain-old"];
    expect(favoriteFirst(items, (item) => item.startsWith("favorite"))).toEqual([
      "favorite-old",
      "favorite-new",
      "plain-new",
      "plain-old",
    ]);
  });

  test("preserves either native Recent direction", () => {
    const newest = ["favorite-new", "plain-new", "favorite-old", "plain-old"];
    const oldest = newest.toReversed();
    const favored = (item: string) => item.startsWith("favorite");
    expect(favoriteFirst(newest, favored)).toEqual(["favorite-new", "favorite-old", "plain-new", "plain-old"]);
    expect(favoriteFirst(oldest, favored)).toEqual(["favorite-old", "favorite-new", "plain-old", "plain-new"]);
  });
});
