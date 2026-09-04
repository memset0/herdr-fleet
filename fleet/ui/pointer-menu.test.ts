import { describe, expect, it } from "bun:test";

import { createPointerMenuStore, POINTER_MENU_TTL_MS } from "./pointer-menu.ts";

function storeAt(clock: { now: number }) {
  return createPointerMenuStore(() => clock.now);
}

describe("createPointerMenuStore", () => {
  it("claims a mouse's right-click once", () => {
    const clock = { now: 0 };
    const store = storeAt(clock);
    store.notePointer("mouse");
    store.note(120, 240);
    expect(store.take()).toEqual({ x: 120, y: 240, at: 0 });
    expect(store.take()).toBeNull();
  });

  it("ignores a touch's context menu, so a phone keeps the sheet", () => {
    const clock = { now: 0 };
    const store = storeAt(clock);
    store.notePointer("touch");
    store.note(120, 240);
    expect(store.take()).toBeNull();
  });

  it("ignores the keyboard's menu key, which reports the origin", () => {
    const clock = { now: 0 };
    const store = storeAt(clock);
    store.notePointer("mouse");
    store.note(0, 0);
    expect(store.take()).toBeNull();
  });

  it("lets an unclaimed gesture go stale rather than placing a later sheet", () => {
    const clock = { now: 0 };
    const store = storeAt(clock);
    store.notePointer("mouse");
    store.note(10, 10);
    clock.now = POINTER_MENU_TTL_MS + 1;
    expect(store.take()).toBeNull();
  });
});
