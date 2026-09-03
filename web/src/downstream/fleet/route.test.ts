import {
  FLEET_ROUTE_MESSAGE_TYPE,
  FLEET_ROUTE_MESSAGE_VERSION,
  fleetRouteMessage,
  postFleetRoute,
} from "./route";

describe("fleetRouteMessage", () => {
  it("maps the primary and named-session homepages", () => {
    expect(fleetRouteMessage("/", "")).toEqual({
      type: FLEET_ROUTE_MESSAGE_TYPE,
      version: FLEET_ROUTE_MESSAGE_VERSION,
      view: "home",
    });
    expect(fleetRouteMessage("/", "?s=cluster-demo")).toEqual({
      type: FLEET_ROUTE_MESSAGE_TYPE,
      version: FLEET_ROUTE_MESSAGE_VERSION,
      view: "home",
      session: "cluster-demo",
    });
  });

  it("maps Pane detail and history to one canonical Pane selector", () => {
    const expected = {
      type: FLEET_ROUTE_MESSAGE_TYPE,
      version: FLEET_ROUTE_MESSAGE_VERSION,
      view: "pane",
      paneId: "wH:p8",
      session: "cluster-demo",
    } as const;
    const location = { paneId: "wH:p8", workspaceId: "wH", tabId: "wH:t2" };
    const complete = { ...expected, spaceId: "wH", tabId: "wH:t2" };
    expect(fleetRouteMessage("/pane/wH%3Ap8", "?s=cluster-demo", location)).toEqual(complete);
    expect(fleetRouteMessage("/pane/wH%3Ap8/history", "?s=cluster-demo", location)).toEqual(complete);
    expect(
      fleetRouteMessage("/pane/wH%3Ap8", "?s=cluster-demo", { ...location, paneId: "wH:p9" }),
    ).toEqual(expected);
  });

  it("canonicalizes unsupported and malformed routes to the homepage", () => {
    expect(fleetRouteMessage("/settings", "").view).toBe("home");
    expect(fleetRouteMessage("/space/w1", "?s=demo")).toMatchObject({
      view: "home",
      session: "demo",
    });
    expect(fleetRouteMessage("/pane/%", "")).toMatchObject({ view: "home" });
  });
});

describe("postFleetRoute", () => {
  it("posts the versioned route to a framed parent and is inert when top-level", () => {
    const postMessage = vi.fn();
    const message = fleetRouteMessage("/pane/w1%3Ap1", "");

    expect(postFleetRoute(message, { postMessage }, true)).toBe(true);
    expect(postMessage).toHaveBeenCalledWith(message, "*");

    postMessage.mockClear();
    expect(postFleetRoute(message, { postMessage }, false)).toBe(false);
    expect(postMessage).not.toHaveBeenCalled();
  });
});
