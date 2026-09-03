import { describe, expect, test } from "bun:test";

import {
  CJK_FALLBACK_NONE,
  CJK_FALLBACK_MAX_BYTES,
  CJK_FALLBACK_STORAGE_KEY,
  DEFAULT_CJK_FALLBACK,
  FLEET_WEBFONTS,
  FleetCjkFallbackStore,
  fleetWebfont,
  isCjkFallback,
  parseCjkFallback,
  type CjkFallbackStorage,
} from "./webfonts";

class MemoryStorage implements CjkFallbackStorage {
  value: string | null;
  throwOnGet = false;
  throwOnSet = false;

  constructor(value: string | null = null) {
    this.value = value;
  }

  getItem(): string | null {
    if (this.throwOnGet) throw new Error("read refused");
    return this.value;
  }

  setItem(key: string, value: string): void {
    expect(key).toBe(CJK_FALLBACK_STORAGE_KEY);
    if (this.throwOnSet) throw new Error("write refused");
    this.value = value;
  }
}

describe("fleet webfont catalog", () => {
  test("every entry names one family over one https origin", () => {
    expect(FLEET_WEBFONTS.length).toBeGreaterThan(0);
    for (const font of FLEET_WEBFONTS) {
      expect(font.id).toMatch(/^[a-z0-9-]+$/);
      expect(font.family.length).toBeGreaterThan(0);
      expect(new URL(font.href).protocol).toBe("https:");
      expect(font.label.length).toBeGreaterThan(0);
    }
    expect(fleetWebfont(DEFAULT_CJK_FALLBACK)).not.toBeNull();
    expect(fleetWebfont(CJK_FALLBACK_NONE)).toBeNull();
    expect(fleetWebfont("../../etc/passwd")).toBeNull();
  });

  test("only a catalog id or `none` is a choice", () => {
    expect(isCjkFallback(CJK_FALLBACK_NONE)).toBe(true);
    expect(isCjkFallback(DEFAULT_CJK_FALLBACK)).toBe(true);
    expect(isCjkFallback("https://elsewhere.example/font.css")).toBe(false);
    expect(isCjkFallback("")).toBe(false);
  });
});

describe("fleet CJK fallback preference", () => {
  test("a device that has said nothing gets the default face", () => {
    expect(parseCjkFallback(null)).toBe(DEFAULT_CJK_FALLBACK);
    expect(new FleetCjkFallbackStore(new MemoryStorage()).snapshot()).toBe(DEFAULT_CJK_FALLBACK);
  });

  test("restores a stored choice, including the explicit refusal", () => {
    expect(parseCjkFallback(JSON.stringify({ version: 1, font: CJK_FALLBACK_NONE }))).toBe(
      CJK_FALLBACK_NONE,
    );
    expect(parseCjkFallback(JSON.stringify({ version: 1, font: DEFAULT_CJK_FALLBACK }))).toBe(
      DEFAULT_CJK_FALLBACK,
    );
  });

  test("refuses malformed, unknown, unversioned and oversized records", () => {
    expect(parseCjkFallback("{")).toBe(DEFAULT_CJK_FALLBACK);
    expect(parseCjkFallback(JSON.stringify({ version: 2, font: CJK_FALLBACK_NONE }))).toBe(
      DEFAULT_CJK_FALLBACK,
    );
    expect(parseCjkFallback(JSON.stringify({ version: 1, font: "elsewhere" }))).toBe(
      DEFAULT_CJK_FALLBACK,
    );
    expect(parseCjkFallback(JSON.stringify({ version: 1, font: CJK_FALLBACK_NONE, x: 1 }))).toBe(
      DEFAULT_CJK_FALLBACK,
    );
    expect(parseCjkFallback("x".repeat(CJK_FALLBACK_MAX_BYTES + 1))).toBe(DEFAULT_CJK_FALLBACK);
  });

  test("writes only a value it would accept back, and survives storage that throws", () => {
    const storage = new MemoryStorage();
    const store = new FleetCjkFallbackStore(storage);
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });

    store.set("elsewhere");
    expect(store.snapshot()).toBe(DEFAULT_CJK_FALLBACK);
    expect(notified).toBe(0);

    store.set(CJK_FALLBACK_NONE);
    expect(store.snapshot()).toBe(CJK_FALLBACK_NONE);
    expect(notified).toBe(1);
    expect(parseCjkFallback(storage.value)).toBe(CJK_FALLBACK_NONE);

    storage.throwOnSet = true;
    store.set(DEFAULT_CJK_FALLBACK);
    expect(store.snapshot()).toBe(DEFAULT_CJK_FALLBACK);
  });

  test("a browser that refuses to be read still gets a usable default", () => {
    const storage = new MemoryStorage(JSON.stringify({ version: 1, font: CJK_FALLBACK_NONE }));
    storage.throwOnGet = true;
    expect(new FleetCjkFallbackStore(storage).snapshot()).toBe(DEFAULT_CJK_FALLBACK);
  });
});
