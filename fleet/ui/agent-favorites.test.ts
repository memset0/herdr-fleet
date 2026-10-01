import { describe, expect, test } from "bun:test";

import {
  AGENT_FAVORITES_STORAGE_KEY,
  forgetLegacyFavorites,
  matchesLegacyFavorite,
  parseLegacyFavorites,
  readLegacyFavorites,
  type LegacyFavoriteStorage,
} from "./agent-favorites.ts";

class MemoryStorage implements LegacyFavoriteStorage {
  constructor(public value: string | null = null, public throwing = false) {}

  getItem(key: string): string | null {
    expect(key).toBe(AGENT_FAVORITES_STORAGE_KEY);
    if (this.throwing) throw new Error("blocked");
    return this.value;
  }

  removeItem(key: string): void {
    expect(key).toBe(AGENT_FAVORITES_STORAGE_KEY);
    if (this.throwing) throw new Error("blocked");
    this.value = null;
  }
}

const doc = (favorites: unknown[]) => JSON.stringify({ version: 1, favorites });

describe("the retired favourites record", () => {
  test("reads every stored tuple the retired store wrote", () => {
    expect(parseLegacyFavorites(doc([["lead", "work", "w1:p1", "claude"], [null, null, "w2:p3", "codex"]]))).toEqual([
      { host: "lead", session: "work", paneId: "w1:p1", agent: "claude" },
      { host: null, session: null, paneId: "w2:p3", agent: "codex" },
    ]);
  });

  test("refuses whatever the retired store would have refused", () => {
    for (const raw of [
      "not json",
      JSON.stringify({ version: 2, favorites: [] }),
      JSON.stringify({ version: 1, favorites: [], extra: true }),
      doc([["lead", "work", "", "claude"]]),
      doc([["lead", "work", "w1:p1"]]),
      doc(Array.from({ length: 257 }, (_, i) => [null, null, `p${i}`, "claude"])),
      "x".repeat(40_000),
    ]) {
      expect(parseLegacyFavorites(raw)).toEqual([]);
    }
  });

  test("says there is nothing to migrate when no record is stored or storage is blocked", () => {
    expect(readLegacyFavorites(null)).toBeNull();
    expect(readLegacyFavorites(new MemoryStorage())).toBeNull();
    expect(readLegacyFavorites(new MemoryStorage(doc([]), true))).toBeNull();
    expect(readLegacyFavorites(new MemoryStorage("garbage"))).toEqual([]);
  });

  test("deletes the record, and survives a storage that refuses", () => {
    const storage = new MemoryStorage(doc([]));
    forgetLegacyFavorites(storage);
    expect(storage.value).toBeNull();
    expect(() => forgetLegacyFavorites(new MemoryStorage(doc([]), true))).not.toThrow();
  });

  test("matches a live row only on the same machine, session, pane and Agent", () => {
    const favorite = { host: "lead", session: "work", paneId: "w1:p1", agent: "claude" };
    const row = { host: "lead", session: "work", paneId: "w1:p1", agent: "claude" };
    expect(matchesLegacyFavorite(favorite, row)).toBeTrue();
    expect(matchesLegacyFavorite(favorite, { ...row, host: "peer" })).toBeFalse();
    expect(matchesLegacyFavorite(favorite, { ...row, session: "other" })).toBeFalse();
    expect(matchesLegacyFavorite(favorite, { ...row, agent: "codex" })).toBeFalse();
    expect(matchesLegacyFavorite(favorite, { ...row, kind: "shell" })).toBeFalse();
    expect(matchesLegacyFavorite({ ...favorite, host: null, session: null }, { paneId: "w1:p1", agent: "claude" })).toBeTrue();
  });
});
