import { describe, expect, test } from "bun:test";

import {
  manualPaneFitColumns,
  parsePaneFitAnswer,
  parsePaneFitAvailability,
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

describe("the Gateway's answers, narrowed", () => {
  test("availability is the lead flag and string member ids, or nothing", () => {
    expect(parsePaneFitAvailability({ lead: true, members: ["member-a", 7] })).toEqual({
      lead: true,
      members: ["member-a"],
    });
    expect(parsePaneFitAvailability({ lead: "yes", members: [] })).toBeNull();
    expect(parsePaneFitAvailability({ error: "not found" })).toBeNull();
  });

  test("a resize answer is a result or a closed failure", () => {
    expect(parsePaneFitAnswer({ ok: true, cols: 80, rows: 31 })).toEqual({ ok: true, cols: 80, rows: 31 });
    expect(parsePaneFitAnswer({ ok: false, reason: "conflict" })).toEqual({ ok: false, reason: "conflict" });
    expect(parsePaneFitAnswer({ ok: false, reason: "anything" })).toEqual({ ok: false, reason: "failed" });
    expect(parsePaneFitAnswer("ok")).toEqual({ ok: false, reason: "failed" });
  });
});
