import { describe, expect, test } from "bun:test";

import { resolveInSnapshot, resolveTerminal, type TerminalSnapshot } from "./resolve.ts";

const snapshot: TerminalSnapshot = {
  panes: [
    { pane_id: "w1:p1", terminal_id: "term_65aad773f6c692a" },
    { pane_id: "w1:p2", terminal_id: "term_65a886c8324e43" },
    { pane_id: "w2:p1", terminal_id: null },
    { pane_id: "w2:p2" },
  ],
};

describe("resolving a Pane on the machine that owns it", () => {
  test("one live match yields that Pane's terminal", () => {
    expect(resolveInSnapshot({ paneId: "w1:p1" }, snapshot))
      .toEqual({ ok: true, terminalId: "term_65aad773f6c692a" });
  });

  test("a Pane that is not in the snapshot is refused", () => {
    expect(resolveInSnapshot({ paneId: "w9:p9" }, snapshot))
      .toEqual({ ok: false, reason: "pane-absent" });
  });

  test("an ambiguous id is refused rather than resolved to the first", () => {
    const doubled: TerminalSnapshot = {
      panes: [
        { pane_id: "w1:p1", terminal_id: "term_aaa" },
        { pane_id: "w1:p1", terminal_id: "term_bbb" },
      ],
    };
    expect(resolveInSnapshot({ paneId: "w1:p1" }, doubled))
      .toEqual({ ok: false, reason: "pane-ambiguous" });
  });

  test("a Pane with no terminal is refused, null or absent alike", () => {
    expect(resolveInSnapshot({ paneId: "w2:p1" }, snapshot)).toEqual({ ok: false, reason: "no-terminal" });
    expect(resolveInSnapshot({ paneId: "w2:p2" }, snapshot)).toEqual({ ok: false, reason: "no-terminal" });
  });

  test("a malformed terminal id from an unexpected server stops here", () => {
    const odd: TerminalSnapshot = { panes: [{ pane_id: "w1:p1", terminal_id: "; rm -rf /" }] };
    expect(resolveInSnapshot({ paneId: "w1:p1" }, odd)).toEqual({ ok: false, reason: "no-terminal" });
  });

  test("there is no fallback to a focused, first or neighbouring Pane", () => {
    // The snapshot has four Panes and the target names none of them; nothing is returned.
    const refused = resolveInSnapshot({ paneId: "w7:p7" }, snapshot);
    expect(refused).toEqual({ ok: false, reason: "pane-absent" });
  });
});

describe("a Pane on another machine", () => {
  test("is not the lead's to resolve, even when an id of that shape exists locally", () => {
    expect(resolveInSnapshot({ paneId: "w1:p1", host: "laptop" }, snapshot))
      .toEqual({ ok: false, reason: "not-local" });
  });
});

describe("resolving against a live source", () => {
  test("passes a healthy snapshot through", async () => {
    expect(await resolveTerminal({ paneId: "w1:p2" }, async () => snapshot))
      .toEqual({ ok: true, terminalId: "term_65a886c8324e43" });
  });

  test("an unavailable server is a refusal, not an exception", async () => {
    const thrown = await resolveTerminal({ paneId: "w1:p1" }, async () => {
      throw new Error("socket is not there");
    });
    expect(thrown).toEqual({ ok: false, reason: "snapshot-unavailable" });
  });

  test("a member's Pane never reaches the source at all", async () => {
    let asked = false;
    const refused = await resolveTerminal({ paneId: "w1:p1", host: "laptop" }, async () => {
      asked = true;
      return snapshot;
    });
    expect(refused).toEqual({ ok: false, reason: "not-local" });
    expect(asked).toBe(false);
  });
});
