import { describe, expect, test } from "bun:test";

import { fleetRefreshWaitMs } from "./refresh.ts";

describe("Fleet refresh model", () => {
  test("follows the Gateway deadline with a bounded fallback", () => {
    expect(fleetRefreshWaitMs(10_100, 5_100)).toBe(5_000);
    expect(fleetRefreshWaitMs(5_101, 5_100)).toBe(250);
    expect(fleetRefreshWaitMs(Number.NaN, 5_100)).toBe(5_000);
  });
});
