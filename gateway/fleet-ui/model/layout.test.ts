import { describe, expect, test } from "bun:test";

import {
  fleetRailResize,
  fleetRailWidthPreferences,
  fleetRailWidths,
} from "./layout.ts";

describe("Fleet layout model", () => {
  test("clamps rails around the centre budget", () => {
    expect(fleetRailWidths(null, 1_200)).toEqual({ left: 224, right: 336 });
    const constrained = fleetRailWidths({ left: 9_999, right: 9_999 }, 1_200);
    expect(constrained.left).toBeGreaterThanOrEqual(176);
    expect(constrained.right).toBeGreaterThanOrEqual(256);
    expect(constrained.left + constrained.right).toBeLessThanOrEqual(560);
    expect(
      fleetRailResize({ left: 176, right: 256 }, "right", 400, 1_200),
    ).toEqual({ left: 176, right: 384 });
    expect(
      fleetRailResize({ left: 224, right: 336 }, "left", Number.NaN, 1_600),
    ).toEqual({ left: 224, right: 336 });
  });

  test("accepts only the current finite preference schema", () => {
    expect(
      fleetRailWidthPreferences('{"version":1,"left":248,"right":368}'),
    ).toEqual({ left: 248, right: 368 });
    expect(
      fleetRailWidthPreferences('{"version":2,"left":248,"right":368}'),
    ).toBeNull();
    expect(
      fleetRailWidthPreferences('{"version":1,"left":-1,"right":368}'),
    ).toBeNull();
    expect(fleetRailWidthPreferences("not json")).toBeNull();
  });
});
