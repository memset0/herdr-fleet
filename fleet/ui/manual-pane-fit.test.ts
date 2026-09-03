import { describe, expect, test } from "bun:test";

import {
  manualPaneFitColumns,
  runManualPaneFit,
} from "./manual-pane-fit.ts";

describe("manual Pane fit geometry", () => {
  test("subtracts horizontal padding, floors complete cells, and clamps 20..500", () => {
    expect(
      manualPaneFitColumns({
        scrollportWidth: 813,
        paddingLeft: 8,
        paddingRight: 8,
        cellWidth: 10,
      }),
    ).toBe(79);
    expect(
      manualPaneFitColumns({
        scrollportWidth: 120,
        paddingLeft: 10,
        paddingRight: 10,
        cellWidth: 10,
      }),
    ).toBe(20);
    expect(
      manualPaneFitColumns({
        scrollportWidth: 10_000,
        paddingLeft: 0,
        paddingRight: 0,
        cellWidth: 1,
      }),
    ).toBe(500);
  });

  test("rejects missing, zero, negative, and non-finite metrics", () => {
    const valid = {
      scrollportWidth: 800,
      paddingLeft: 8,
      paddingRight: 8,
      cellWidth: 10,
    };
    for (const geometry of [
      { ...valid, scrollportWidth: 0 },
      { ...valid, scrollportWidth: Number.NaN },
      { ...valid, paddingLeft: -1 },
      { ...valid, paddingRight: Number.POSITIVE_INFINITY },
      { ...valid, cellWidth: 0 },
      { ...valid, cellWidth: Number.NaN },
      { ...valid, paddingLeft: 500, paddingRight: 500 },
    ]) {
      expect(() => manualPaneFitColumns(geometry)).toThrow("invalid terminal geometry");
    }
  });

  test("does nothing without an explicit invocation and fails before request without a scrollport", async () => {
    let calls = 0;
    const request = async () => {
      calls += 1;
      return { ok: true, cols: 80, rows: 24 } as const;
    };
    expect(calls).toBe(0);
    expect(await runManualPaneFit(null, 13, request)).toEqual({
      ok: false,
      reason: "geometry",
    });
    expect(calls).toBe(0);
  });
});
