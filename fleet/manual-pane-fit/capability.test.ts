import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { MUX_ADAPTERS } from "../../bridge/mux/registry.ts";
import { apiPathFor, crewRouteFor, forwardAuditAction } from "../../bridge/crew/forward.ts";
import { crewUrl } from "../../bridge/crew/peer-client.ts";
import { isPaneReadAction } from "../../bridge/server.ts";

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
    expect(source).toContain("const isRead = !action || isPaneReadAction(action)");
    expect(isPaneReadAction("resize")).toBe(false);
    expect(source).toContain('paneResizeMatch === null ? paneMatch[2] : "resize"');
    expect(source).toContain('action === "resize" && req.method === "POST"');
    expect(source).toContain("manualPaneFit.resize(rt, paneId, req, audit_, device");
  });

  test("a resize reaches the machine the Pane is on", () => {
    // It did not, for as long as the feature existed: the route was declared in a literal of its
    // own, the link's correspondence test read `PANE_ROUTE` by name, and every resize addressed to
    // another member came back 501 as a route that is not federated. This case is here, in the
    // feature's own suite, so the answer does not depend only on a test that already missed it once.
    expect(crewRouteFor("/api/pane/w1:p1/resize")).toBe("pane/w1:p1/resize");
    // Dialled on the crew prefix, and dispatched on the member into its own local route.
    expect(crewUrl("127.0.0.1:19791", "pane/w1:p1/resize")).toBe("https://127.0.0.1:19791/crew/v1/pane/w1:p1/resize");
    expect(apiPathFor("pane/w1:p1/resize")).toBe("/api/pane/w1:p1/resize");
    // And the lead's record of the forward says what the peer's own handler writes, so the two
    // independent logs read against each other.
    expect(forwardAuditAction("pane/w1:p1/resize")).toBe("pane.resize");
    const action = readFileSync(new URL("./action.ts", import.meta.url), "utf8");
    expect(action).toContain('action: "pane.resize"');
  });

  test("the Display row asks the Pane's own Host, not the lead", () => {
    // Collie answers `/api/config?host=` from each member's own capability table and falls back to
    // the lead's declaration for a member that reports none (`scopedMuxConfig`, covered upstream in
    // web/src/lib/mux-capability.test.ts). The fork's part is passing the Pane's scope.
    const chat = readFileSync(new URL("../../web/src/components/agent-chat.tsx", import.meta.url), "utf8");
    expect(chat).toContain('useMuxCapability("resizePane", scope)');
    expect(chat).not.toContain('useMuxCapability("resizePane")');
  });
});
