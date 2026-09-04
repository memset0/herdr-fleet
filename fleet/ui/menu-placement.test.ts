import { describe, expect, it } from "bun:test";

import { MENU_MARGIN, placeMenu } from "./menu-placement.ts";

const VIEWPORT = { width: 1000, height: 800 };

describe("placeMenu", () => {
  it("opens down and to the right of the cursor when there is room", () => {
    expect(placeMenu({ x: 100, y: 200 }, { width: 240, height: 180 }, VIEWPORT)).toEqual({
      left: 100,
      top: 200,
      origin: "left top",
    });
  });

  it("flips rather than slides when the box would run past an edge", () => {
    // Sliding would put rows under the cursor, so the box ends AT the point instead.
    expect(placeMenu({ x: 900, y: 750 }, { width: 240, height: 180 }, VIEWPORT)).toEqual({
      left: 660,
      top: 570,
      origin: "right bottom",
    });
  });

  it("flips one axis without disturbing the other", () => {
    expect(placeMenu({ x: 900, y: 100 }, { width: 240, height: 180 }, VIEWPORT)).toEqual({
      left: 660,
      top: 100,
      origin: "right top",
    });
  });

  it("flips right up against the far edge rather than sliding back inside", () => {
    // The flipped box ends exactly at the cursor, 10px short of the edge — still a flip, because
    // sliding it in would put a row under the release of the click that opened it.
    expect(placeMenu({ x: 990, y: 40 }, { width: 240, height: 20 }, VIEWPORT).left).toBe(750);
  });

  it("pins to the margin when neither side of the point fits", () => {
    expect(placeMenu({ x: 5, y: 5 }, { width: 240, height: 20 }, { width: 200, height: 800 })).toEqual(
      { left: MENU_MARGIN, top: 5, origin: "left top" },
    );
  });

  it("pins a box larger than the space rather than anchoring it off screen", () => {
    const placed = placeMenu({ x: 500, y: 400 }, { width: 240, height: 900 }, VIEWPORT);
    expect(placed.top).toBe(MENU_MARGIN);
  });

  it("names the corner the cursor is on, so the box grows out of it and not out of its middle", () => {
    expect(placeMenu({ x: 100, y: 200 }, { width: 240, height: 180 }, VIEWPORT).origin).toBe("left top");
    expect(placeMenu({ x: 900, y: 750 }, { width: 240, height: 180 }, VIEWPORT).origin).toBe("right bottom");
    expect(placeMenu({ x: 100, y: 750 }, { width: 240, height: 180 }, VIEWPORT).origin).toBe("left bottom");
  });
});
