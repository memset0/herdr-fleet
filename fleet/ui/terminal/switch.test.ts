import { describe, expect, test } from "bun:test";

import {
  DEFAULT_PANE_SURFACE,
  PaneSurfacePreferenceStore,
  TERMINAL_SWITCH_STORAGE_KEY,
  parsePaneSurface,
  type StorageLike,
} from "./switch.ts";

function storage(initial: string | null = null): StorageLike & { value: string | null } {
  const box = {
    value: initial,
    getItem: (key: string) => (key === TERMINAL_SWITCH_STORAGE_KEY ? box.value : null),
    setItem: (key: string, value: string) => {
      if (key === TERMINAL_SWITCH_STORAGE_KEY) box.value = value;
    },
  };
  return box;
}

describe("the default", () => {
  test("is the mirror — the surface that works everywhere", () => {
    expect(DEFAULT_PANE_SURFACE).toBe("mirror");
    expect(new PaneSurfacePreferenceStore(null).snapshot()).toBe("mirror");
    expect(new PaneSurfacePreferenceStore(storage()).snapshot()).toBe("mirror");
  });

  test.each([
    ["not JSON", "terminal"],
    ["a bare string", '"terminal"'],
    ["a foreign version", '{"version":2,"surface":"terminal"}'],
    ["a surface nobody defined", '{"version":1,"surface":"holodeck"}'],
    ["null", "null"],
    ["an array", '[{"version":1,"surface":"terminal"}]'],
  ])("recovers from %s", (_label, raw) => {
    expect(parsePaneSurface(raw)).toBe("mirror");
  });

  test("recovers from a value too large to be this preference", () => {
    expect(parsePaneSurface(JSON.stringify({ version: 1, surface: "terminal", pad: "x".repeat(400) }))).toBe(
      "mirror",
    );
  });

  test("recovers from storage that throws rather than failing the app", () => {
    const hostile: StorageLike = {
      getItem: () => {
        throw new Error("storage is not available in this context");
      },
      setItem: () => {
        throw new Error("storage is not available in this context");
      },
    };
    const store = new PaneSurfacePreferenceStore(hostile);
    expect(store.snapshot()).toBe("mirror");
    // And a set still switches this document, even though nothing can be written down.
    store.set("terminal");
    expect(store.snapshot()).toBe("terminal");
  });
});

describe("the round trip", () => {
  test("what one store writes, the next one reads", () => {
    const box = storage();
    const first = new PaneSurfacePreferenceStore(box);
    first.set("terminal");
    expect(new PaneSurfacePreferenceStore(box).snapshot()).toBe("terminal");
    first.set("mirror");
    expect(new PaneSurfacePreferenceStore(box).snapshot()).toBe("mirror");
  });

  test("toggling goes both ways and tells its subscribers once each", () => {
    const store = new PaneSurfacePreferenceStore(storage());
    let notified = 0;
    const stop = store.subscribe(() => {
      notified += 1;
    });
    store.toggle();
    expect(store.snapshot()).toBe("terminal");
    store.toggle();
    expect(store.snapshot()).toBe("mirror");
    expect(notified).toBe(2);
    // Setting what is already set is not a change, and does not wake a subscriber.
    store.set("mirror");
    expect(notified).toBe(2);
    stop();
    store.toggle();
    expect(notified).toBe(2);
  });
});
