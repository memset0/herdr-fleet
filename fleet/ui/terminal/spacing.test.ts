import { describe, expect, test } from "bun:test";

import {
  DEFAULT_TERMINAL_SPACING,
  TERMINAL_SPACING_STORAGE_KEY,
  TerminalSpacingPreference,
  boundSpacing,
  parseTerminalSpacing,
} from "./spacing.ts";

describe("bounding a spacing value", () => {
  test("keeps an in-range value on its step", () => {
    expect(boundSpacing("lineHeight", 1.3)).toBe(1.3);
    expect(boundSpacing("lineHeight", 1.32)).toBe(1.3);
    expect(boundSpacing("letterSpacing", -0.5)).toBe(-0.5);
    expect(boundSpacing("letterSpacing", 1.3)).toBe(1.5);
  });

  test("reads anything out of range or not a number as the default", () => {
    // xterm throws on a line height below 1, so this one is a crash avoided, not a preference.
    expect(boundSpacing("lineHeight", 0.9)).toBe(1);
    expect(boundSpacing("lineHeight", 2.5)).toBe(1);
    expect(boundSpacing("letterSpacing", -3)).toBe(0);
    expect(boundSpacing("letterSpacing", Number.NaN)).toBe(0);
    expect(boundSpacing("letterSpacing", null)).toBe(0);
  });
});

describe("parsing the stored value", () => {
  test("accepts its own shape and defaults each malformed field on its own", () => {
    expect(parseTerminalSpacing('{"version":1,"lineHeight":1.5,"letterSpacing":2}')).toEqual({ lineHeight: 1.5, letterSpacing: 2 });
    expect(parseTerminalSpacing('{"version":1,"lineHeight":"1.5","letterSpacing":9}')).toEqual(DEFAULT_TERMINAL_SPACING);
    expect(parseTerminalSpacing('{"version":1,"lineHeight":1.2,"letterSpacing":"x"}')).toEqual({ lineHeight: 1.2, letterSpacing: 0 });
  });

  test.each([null, "", "not json", "[]", '{"version":2,"lineHeight":1.5}', "x".repeat(300)])("%p is the default", (raw) => {
    expect(parseTerminalSpacing(raw)).toEqual(DEFAULT_TERMINAL_SPACING);
  });
});

describe("the preference", () => {
  test("stores a bounded value, resets with null, and survives a storage that throws", () => {
    const box: Record<string, string> = {};
    const storage = { getItem: (key: string) => box[key] ?? null, setItem: (key: string, value: string) => void (box[key] = value) };
    const preference = new TerminalSpacingPreference(storage);
    expect(preference.snapshot()).toEqual(DEFAULT_TERMINAL_SPACING);
    preference.set("lineHeight", 1.25);
    expect(JSON.parse(box[TERMINAL_SPACING_STORAGE_KEY]!)).toEqual({ version: 1, lineHeight: 1.25, letterSpacing: 0 });
    expect(new TerminalSpacingPreference(storage).snapshot().lineHeight).toBe(1.25);
    preference.set("lineHeight", null);
    expect(preference.snapshot()).toEqual(DEFAULT_TERMINAL_SPACING);

    const thrower = () => {
      throw new Error("denied");
    };
    const refused = new TerminalSpacingPreference({ getItem: thrower, setItem: thrower });
    refused.set("letterSpacing", 1);
    expect(refused.snapshot().letterSpacing).toBe(1);
  });
});
