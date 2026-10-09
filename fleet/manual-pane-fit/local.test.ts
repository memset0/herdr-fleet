import { describe, expect, test } from "bun:test";

import { ManualPaneFitControllerError, type PaneFitSize } from "./controller.ts";
import { createLocalPaneFit, type PaneFitController } from "./local.ts";
import type { SnapshotPane } from "../terminal/resolve.ts";

function fake(failure?: "conflict" | "failed") {
  const calls: Array<{ socketPath: string; paneId: string; size: PaneFitSize }> = [];
  let disposed = 0;
  const controller: PaneFitController = {
    async resize(socketPath, paneId, size) {
      calls.push({ socketPath, paneId, size });
      if (failure !== undefined) throw new ManualPaneFitControllerError(failure);
    },
    get activeCount() {
      return calls.length;
    },
    disposeAll: () => void disposed++,
  };
  return { controller, calls, disposed: () => disposed };
}

function fit(panes: SnapshotPane[], controller: PaneFitController, source?: () => Promise<{ panes: SnapshotPane[] }>) {
  return createLocalPaneFit({
    source: source ?? (async () => ({ panes })),
    socketPath: "/run/herdr.sock",
    controller,
  });
}

const pane = (pane_id: string, viewport_rows?: number): SnapshotPane =>
  viewport_rows === undefined ? { pane_id } : { pane_id, scroll: { viewport_rows } };

describe("local Pane fit", () => {
  test("keeps the server's own rows and drives the controller on the local socket", async () => {
    const { controller, calls } = fake();
    const result = await fit([pane("w1:p1", 31), pane("w1:p2", 40)], controller).resize("w1:p1", 72);
    expect(result).toEqual({ ok: true, cols: 72, rows: 31 });
    expect(calls).toEqual([{ socketPath: "/run/herdr.sock", paneId: "w1:p1", size: { cols: 72, rows: 31 } }]);
  });

  test("refuses out-of-range columns before reading anything", async () => {
    const { controller, calls } = fake();
    let reads = 0;
    const core = fit([], controller, async () => {
      reads += 1;
      return { panes: [pane("w1:p1", 31)] };
    });
    for (const cols of [19, 501, 80.5]) expect((await core.resize("w1:p1", cols)).ok).toBe(false);
    expect(reads).toBe(0);
    expect(calls).toEqual([]);
  });

  test("an absent or ambiguous Pane fails without touching any other Pane", async () => {
    const { controller, calls } = fake();
    expect(await fit([pane("w1:p2", 31)], controller).resize("w1:p1", 72)).toMatchObject({ ok: false, reason: "failed" });
    expect(await fit([pane("w1:p1", 31), pane("w1:p1", 31)], controller).resize("w1:p1", 72)).toMatchObject({
      ok: false,
      reason: "failed",
    });
    expect(calls).toEqual([]);
  });

  test("missing rows fail before a controller is acquired", async () => {
    const { controller, calls } = fake();
    expect(await fit([pane("w1:p1")], controller).resize("w1:p1", 72)).toMatchObject({ ok: false, reason: "geometry" });
    expect(await fit([pane("w1:p1", 0)], controller).resize("w1:p1", 72)).toMatchObject({ ok: false, reason: "geometry" });
    expect(calls).toEqual([]);
  });

  test("a snapshot failure is a failed resize, not an exception", async () => {
    const { controller } = fake();
    const core = fit([], controller, async () => {
      throw new Error("socket gone");
    });
    expect(await core.resize("w1:p1", 72)).toMatchObject({ ok: false, reason: "failed" });
  });

  test("reports a controller conflict as a conflict and anything else as failed", async () => {
    expect(await fit([pane("w1:p1", 31)], fake("conflict").controller).resize("w1:p1", 72)).toMatchObject({
      ok: false,
      reason: "conflict",
    });
    expect(await fit([pane("w1:p1", 31)], fake("failed").controller).resize("w1:p1", 72)).toMatchObject({
      ok: false,
      reason: "failed",
    });
  });

  test("dispose releases every retained controller", () => {
    const { controller, disposed } = fake();
    fit([], controller).dispose();
    expect(disposed()).toBe(1);
  });
});
