import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { MUX_ADAPTERS } from "../../bridge/mux/registry.ts";
import { forwardAuditAction, packRouteFor } from "../../bridge/pack/forward.ts";

describe("manual Pane fit capability and route port", () => {
  test("only Herdr advertises resizePane", () => {
    const target = { endpoint: "unused", timeoutMs: 100, options: {} };
    const claims = Object.fromEntries(
      MUX_ADAPTERS.map((factory) => [factory.mux, factory.create(target).capabilities.supports.resizePane]),
    );
    expect(claims).toEqual({ herdr: true, tmux: false, zellij: false });
  });

  test("the protected Pane route classifies resize as a write and dispatches the owned action", () => {
    const source = readFileSync(new URL("../../bridge/server.ts", import.meta.url), "utf8");
    expect(source).toContain("const PANE_RESIZE_ROUTE = /^\\/api\\/pane\\/([^/]+)\\/resize$/");
    expect(source).toContain('const isRead = !action || action === "history"');
    expect(source).toContain('paneResizeMatch === null ? paneMatch[2] : "resize"');
    expect(source).toContain('action === "resize" && req.method === "POST"');
    expect(source).toContain("manualPaneFit.resize(rt, paneId, req, audit_, device");
  });

  test("a resize reaches the machine the Pane is on", () => {
    // It did not, for as long as the feature existed: the route was declared in a literal of its
    // own, the pack's correspondence test read `PANE_ROUTE` by name, and every resize addressed to
    // another member came back 501 as a route that is not federated. This case is here, in the
    // feature's own suite, so the answer does not depend only on a test that already missed it once.
    expect(packRouteFor("/api/pane/w1:p1/resize")).toBe("pane/w1:p1/resize");
    // And the lead's record of the forward says what the peer's own handler writes, so the two
    // independent logs read against each other.
    expect(forwardAuditAction("pane/w1:p1/resize")).toBe("pane.resize");
    const action = readFileSync(new URL("./action.ts", import.meta.url), "utf8");
    expect(action).toContain('action: "pane.resize"');
  });
});
