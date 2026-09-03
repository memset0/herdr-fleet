import { describe, expect, test } from "bun:test";

import {
  clampSidebarWidth,
  NavigationPreferenceStore,
  NATIVE_NAVIGATION_MAX_BYTES,
  NATIVE_NAVIGATION_MAX_DISCLOSURES,
  NATIVE_NAVIGATION_STORAGE_KEY,
  parseNativeNavigationPreferences,
  SIDEBAR_BOUNDS,
  widthFromPointerDrag,
  widthFromSeparatorKey,
  type StorageLike,
} from "./preferences";

class MemoryStorage implements StorageLike {
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
    expect(key).toBe(NATIVE_NAVIGATION_STORAGE_KEY);
    if (this.throwOnSet) throw new Error("write refused");
    this.value = value;
  }
}

describe("native navigation preferences", () => {
  test("restores valid independent values and clamps widths", () => {
    const parsed = parseNativeNavigationPreferences(
      JSON.stringify({
        version: 1,
        left: { preferredWidth: 999 },
        right: { preferredWidth: 100 },
        disclosed: ["space:w1"],
      }),
    );
    expect(parsed.left).toEqual({ preferredWidth: SIDEBAR_BOUNDS.left.max });
    expect(parsed.right).toEqual({ preferredWidth: SIDEBAR_BOUNDS.right.min });
    expect(parsed.disclosed).toEqual(["space:w1"]);
  });

  test("reads a record written before the rails became permanently expanded", () => {
    const parsed = parseNativeNavigationPreferences(
      JSON.stringify({
        version: 1,
        left: { preferredWidth: 300, collapsed: true },
        right: { preferredWidth: 340, collapsed: false },
        disclosedSpaces: ["space:w1"],
        disclosedTabs: ["tab:w1:t1"],
      }),
    );
    expect(parsed.left).toEqual({ preferredWidth: 300 });
    expect(parsed.right).toEqual({ preferredWidth: 340 });
    expect(parsed).not.toHaveProperty("collapsed");
    expect(parsed.disclosed).toEqual(["space:w1", "tab:w1:t1"]);
  });

  test("rejects malformed, unknown, oversized, and duplicate records", () => {
    const fallback = parseNativeNavigationPreferences(null);
    expect(parseNativeNavigationPreferences("{")).toEqual(fallback);
    expect(parseNativeNavigationPreferences(JSON.stringify({ version: 2 }))).toEqual(fallback);
    expect(parseNativeNavigationPreferences("x".repeat(NATIVE_NAVIGATION_MAX_BYTES + 1))).toEqual(
      fallback,
    );
    expect(
      parseNativeNavigationPreferences(JSON.stringify({ ...fallback, rails: "gone" })),
    ).toEqual(fallback);
    expect(
      parseNativeNavigationPreferences(
        JSON.stringify({ ...fallback, disclosed: ["space:w1", "space:w1"] }),
      ),
    ).toEqual(fallback);
    expect(
      parseNativeNavigationPreferences(
        JSON.stringify({
          ...fallback,
          disclosed: Array.from(
            { length: NATIVE_NAVIGATION_MAX_DISCLOSURES + 1 },
            (_, index) => `tab:${index}`,
          ),
        }),
      ),
    ).toEqual(fallback);
  });

  test("survives unavailable storage and preserves bounded state after write failure", () => {
    const storage = new MemoryStorage();
    storage.throwOnGet = true;
    const store = new NavigationPreferenceStore(storage);
    storage.throwOnSet = true;
    store.setWidth("left", 350);
    store.ensureDisclosed(["space:w1", "tab:w1:t1"]);
    expect(store.snapshot()).toEqual({
      version: 1,
      left: { preferredWidth: 350 },
      right: { preferredWidth: SIDEBAR_BOUNDS.right.default },
      disclosed: ["space:w1", "tab:w1:t1"],
    });
  });

  test("toggles one identity at a time and never writes a collapsed rail", () => {
    const storage = new MemoryStorage();
    const store = new NavigationPreferenceStore(storage);
    store.toggleDisclosure("space:w1");
    expect(store.snapshot().disclosed).toEqual(["space:w1"]);
    store.toggleDisclosure("space:w1");
    expect(store.snapshot().disclosed).toEqual([]);
    expect(storage.value).not.toContain("collapsed");
  });

  test("bounds disclosure capacity by retaining the newest identities", () => {
    const store = new NavigationPreferenceStore();
    for (let index = 0; index < NATIVE_NAVIGATION_MAX_DISCLOSURES + 5; index += 1) {
      store.ensureDisclosed([`space:${index}`]);
    }
    expect(store.snapshot().disclosed).toHaveLength(NATIVE_NAVIGATION_MAX_DISCLOSURES);
    expect(store.snapshot().disclosed[0]).toBe("space:5");
  });
});

describe("native navigation interactions", () => {
  test("uses side-aware keyboard and pointer movement within bounds", () => {
    expect(widthFromSeparatorKey("left", 280, "ArrowRight")).toBe(296);
    expect(widthFromSeparatorKey("right", 320, "ArrowLeft")).toBe(336);
    expect(widthFromSeparatorKey("left", 280, "Home")).toBe(SIDEBAR_BOUNDS.left.min);
    expect(widthFromSeparatorKey("right", 320, "End")).toBe(SIDEBAR_BOUNDS.right.max);
    expect(widthFromSeparatorKey("left", 280, "Escape")).toBeNull();
    expect(widthFromPointerDrag("left", 280, 100, 160)).toBe(340);
    expect(widthFromPointerDrag("right", 320, 100, 160)).toBe(260);
    expect(clampSidebarWidth("left", Number.NaN)).toBe(SIDEBAR_BOUNDS.left.default);
  });
});
