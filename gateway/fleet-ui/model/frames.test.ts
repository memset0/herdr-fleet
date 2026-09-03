import { describe, expect, test } from "bun:test";

import {
  fleetFrameActivityActive,
  fleetIframeCachePreference,
  fleetIframeCacheQuietExpired,
  fleetIframeEvictionCandidate,
} from "./frames.ts";

describe("Fleet frame model", () => {
  test("parses cache preferences and chooses only a non-selected LRU frame", () => {
    expect(fleetIframeCachePreference(null, 5)).toBe(5);
    expect(fleetIframeCachePreference('{"version":1,"size":3}', 5)).toBe(3);
    expect(fleetIframeCachePreference('{"version":2,"size":3}', 5)).toBe(5);
    expect(fleetIframeCachePreference('{"version":1,"size":11}', 5)).toBe(5);
    expect(fleetIframeCachePreference("bad json", 5)).toBe(5);
    expect(
      fleetIframeEvictionCandidate(
        [
          { id: "selected", lastVisitedAt: 1 },
          { id: "older", lastVisitedAt: 10 },
          { id: "newer", lastVisitedAt: 20 },
        ],
        "selected",
      ),
    ).toBe("older");
    expect(
      fleetIframeEvictionCandidate(
        [{ id: "selected", lastVisitedAt: 1 }],
        "selected",
      ),
    ).toBeNull();
    expect(fleetIframeCacheQuietExpired(1_800_100, 100)).toBeTrue();
    expect(fleetIframeCacheQuietExpired(1_800_099, 100)).toBeFalse();
  });

  test("activates only an unobscured selected frame", () => {
    const base = {
      selected: true,
      frameHidden: false,
      documentHidden: false,
      desktop: true,
      treeOpen: false,
      agentMenuHidden: false,
    };
    expect(fleetFrameActivityActive(base)).toBeTrue();
    expect(fleetFrameActivityActive({ ...base, selected: false })).toBeFalse();
    expect(
      fleetFrameActivityActive({ ...base, frameHidden: true }),
    ).toBeFalse();
    expect(
      fleetFrameActivityActive({ ...base, documentHidden: true }),
    ).toBeFalse();
    expect(
      fleetFrameActivityActive({
        ...base,
        desktop: false,
        agentMenuHidden: true,
      }),
    ).toBeTrue();
    expect(
      fleetFrameActivityActive({
        ...base,
        desktop: false,
        agentMenuHidden: false,
      }),
    ).toBeFalse();
    expect(
      fleetFrameActivityActive({
        ...base,
        desktop: false,
        agentMenuHidden: true,
        treeOpen: true,
      }),
    ).toBeFalse();
  });
});
