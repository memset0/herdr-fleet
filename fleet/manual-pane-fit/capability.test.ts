import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { MUX_ADAPTERS } from "../../bridge/mux/registry.ts";
import { apiPathFor, crewRouteFor, forwardAuditAction } from "../../bridge/crew/forward.ts";
import { crewUrl } from "../../bridge/crew/peer-client.ts";
import { CREW_PREFIX } from "../../bridge/crew/router.ts";
import { isVersion1Path, version1Url, version2PathFor } from "../../bridge/crew/v1-overlap.ts";

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
    // own, the link's correspondence test read `PANE_ROUTE` by name, and every resize addressed to
    // another member came back 501 as a route that is not federated. This case is here, in the
    // feature's own suite, so the answer does not depend only on a test that already missed it once.
    expect(crewRouteFor("/api/pane/w1:p1/resize")).toBe("pane/w1:p1/resize");
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

  // REMOVE_IN_1_9_0 — the two directions of Collie's one-release protocol overlap, as they apply to
  // this fork's one forwarded route. Collie translates prefixes generically, so the route rides the
  // overlap exactly when it is in the crew route table; these cases pin that it is.
  test("a lead on the previous protocol reaches a new member's resize handler", () => {
    const dialled = "/pack/v1/pane/w1:p1/resize";
    expect(isVersion1Path(dialled)).toBe(true);
    const canonical = version2PathFor(dialled);
    expect(canonical).toBe("/crew/v1/pane/w1:p1/resize");
    // The router dispatches the canonical path's route into the member's own local route.
    expect(apiPathFor(canonical.slice(CREW_PREFIX.length))).toBe("/api/pane/w1:p1/resize");
  });

  test("a new lead's resize falls back to the previous prefix for a member not yet levelled", () => {
    const route = crewRouteFor("/api/pane/w1:p1/resize");
    expect(route).not.toBeNull();
    const dial = crewUrl("127.0.0.1:19791", route ?? "");
    expect(dial).toBe("https://127.0.0.1:19791/crew/v1/pane/w1:p1/resize");
    expect(new URL(version1Url(dial ?? "")).pathname).toBe("/pack/v1/pane/w1:p1/resize");
  });
});
