import { describe, expect, test } from "bun:test";

import {
  MANUAL_PANE_FIT_ROWS_MAX_BYTES,
  manualPaneFitColumns,
  ManualPaneFitRowsStore,
  MAX_MANUAL_PANE_FIT_ROWS,
  MIN_MANUAL_PANE_FIT_ROWS,
  parsePaneFitRows,
  parseStoredPaneFitRows,
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
    expect(await runManualPaneFit(null, 13, null, request)).toEqual({
      ok: false,
      reason: "geometry",
    });
    expect(calls).toBe(0);
  });
});

describe("the row count the operator chooses", () => {
  test("reads a bounded integer, and an empty field as no opinion", () => {
    expect(parsePaneFitRows("")).toBeNull();
    expect(parsePaneFitRows("   ")).toBeNull();
    expect(parsePaneFitRows("24")).toBe(24);
    expect(parsePaneFitRows(" 24 ")).toBe(24);
    expect(parsePaneFitRows(String(MIN_MANUAL_PANE_FIT_ROWS - 1))).toBeNull();
    expect(parsePaneFitRows(String(MAX_MANUAL_PANE_FIT_ROWS + 1))).toBeNull();
    expect(parsePaneFitRows("24.5")).toBeNull();
    expect(parsePaneFitRows("-24")).toBeNull();
    expect(parsePaneFitRows("two dozen")).toBeNull();
  });

  test("remembers a bounded choice and refuses to store anything else", () => {
    let written: string | null = null;
    const storage = {
      getItem: () => written,
      setItem: (_key: string, value: string) => {
        written = value;
      },
    };
    const store = new ManualPaneFitRowsStore(storage);
    expect(store.snapshot()).toBeNull();

    store.set(24);
    expect(store.snapshot()).toBe(24);
    expect(new ManualPaneFitRowsStore(storage).snapshot()).toBe(24);

    // Out of bounds is not a choice; it clears rather than sticking at an unusable number.
    store.set(MAX_MANUAL_PANE_FIT_ROWS + 1);
    expect(store.snapshot()).toBeNull();
    expect(new ManualPaneFitRowsStore(storage).snapshot()).toBeNull();
  });

  test("refuses a malformed, unversioned or oversized record", () => {
    expect(parseStoredPaneFitRows("{")).toBeNull();
    expect(parseStoredPaneFitRows(JSON.stringify({ version: 2, rows: 24 }))).toBeNull();
    expect(parseStoredPaneFitRows(JSON.stringify({ version: 1, rows: 24, x: 1 }))).toBeNull();
    expect(parseStoredPaneFitRows(JSON.stringify({ version: 1, rows: "24" }))).toBeNull();
    expect(parseStoredPaneFitRows("x".repeat(MANUAL_PANE_FIT_ROWS_MAX_BYTES + 1))).toBeNull();
  });

});

