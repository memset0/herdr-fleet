import { describe, expect, test } from "bun:test";

import { fuzzyMatch, fuzzyMatchAny } from "./fuzzy.ts";

describe("subsequence matching", () => {
  test("initials find a multi-word name", () => {
    const match = fuzzyMatch("otm", "Toggle Type Mode");
    expect(match).not.toBeNull();
    expect(match?.positions).toEqual([1, 7, 12]);
  });

  test("a contiguous run matches and is marked", () => {
    expect(fuzzyMatch("tab", "Next Tab")?.positions).toEqual([5, 6, 7]);
  });

  test("characters out of order do not match", () => {
    expect(fuzzyMatch("bat", "Next Tab")).toBeNull();
  });

  test("a character that is not there at all does not match", () => {
    expect(fuzzyMatch("tabz", "Next Tab")).toBeNull();
  });

  test("an empty query matches everything with nothing marked", () => {
    expect(fuzzyMatch("", "Anything")).toEqual({ score: 0, positions: [] });
  });

  test("matching ignores case in both directions", () => {
    expect(fuzzyMatch("NEXT", "next tab")).not.toBeNull();
    expect(fuzzyMatch("next", "NEXT TAB")).not.toBeNull();
  });

  test("spaces in the query mean `later`, not a literal space", () => {
    expect(fuzzyMatch("nx tb", "Next Tab")).not.toBeNull();
  });

  test("a word-boundary match outranks a mid-word one", () => {
    const boundary = fuzzyMatch("tab", "Next Tab");
    const midWord = fuzzyMatch("tab", "Untabulated Nonsense Aaaaaaaa Bbbb");
    expect((boundary?.score ?? 0) > (midWord?.score ?? 0)).toBe(true);
  });

  test("a shorter candidate outranks a longer one holding the same match", () => {
    const short = fuzzyMatch("tab", "Next Tab");
    const long = fuzzyMatch("tab", "Next Tab In Some Very Long Place Indeed");
    expect((short?.score ?? 0) > (long?.score ?? 0)).toBe(true);
  });
});

describe("matching across fields", () => {
  test("the best field wins and says which it was", () => {
    const match = fuzzyMatchAny("nt", ["Next Tab", "next-tab", "Prefix+N"]);
    expect(match?.fieldIndex).toBe(0);
  });

  test("a match only in a later field still counts and is attributed to it", () => {
    const match = fuzzyMatchAny("prefix", ["Next Tab", "next-tab", "Prefix+N"]);
    expect(match?.fieldIndex).toBe(2);
  });

  test("no field matching is no match", () => {
    expect(fuzzyMatchAny("zzz", ["Next Tab", "next-tab"])).toBeNull();
  });
});
