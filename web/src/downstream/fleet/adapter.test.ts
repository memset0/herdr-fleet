import { describe, expect, it, vi } from "vitest";
import type { DataRouter } from "react-router";

import { fleetRouteForRouterState, startFleetAdapter } from "./adapter";

type RouterState = DataRouter["state"];

function routerState(pathname = "/", search = ""): RouterState {
  return {
    location: { pathname, search, hash: "", key: "test", state: null },
    loaderData: {
      root: {
        agents: [
          { paneId: "w1:p1", workspaceId: "w1", tabId: "w1:t1" },
        ],
        shellPanes: [],
      },
    },
  } as unknown as RouterState;
}

describe("Fleet adapter", () => {
  it("derives exact route identity from Router state", () => {
    expect(fleetRouteForRouterState(routerState("/pane/w1%3Ap1", "?s=demo"))).toEqual({
      type: "herdr-web-remote:route",
      version: 1,
      view: "pane",
      paneId: "w1:p1",
      spaceId: "w1",
      tabId: "w1:t1",
      session: "demo",
    });
  });

  it("starts, reports, revalidates on activation, and disposes every owned controller", () => {
    let state = routerState();
    let subscriber: ((state: RouterState) => void) | undefined;
    let activate: (() => void) | undefined;
    const stops = [vi.fn(), vi.fn(), vi.fn()];
    const stopObservation = vi.fn();
    const stopRoute = vi.fn();
    const stopActivation = vi.fn();
    const revalidate = vi.fn();
    const report = vi.fn();
    const router = {
      get state() {
        return state;
      },
      subscribe(listener: (next: RouterState) => void) {
        subscriber = listener;
        return stopRoute;
      },
      revalidate,
    };

    const stop = startFleetAdapter(router as never, {
      startActivity: () => stops[0]!,
      startActions: () => stops[1]!,
      startShortcuts: () => stops[2]!,
      registerObservation: () => stopObservation,
      subscribeActivation: (listener) => {
        activate = listener;
        return stopActivation;
      },
      report,
    });

    expect(report).toHaveBeenCalledWith(expect.objectContaining({ view: "home" }));
    state = routerState("/pane/w1%3Ap1");
    subscriber?.(state);
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ view: "pane", paneId: "w1:p1" }));
    activate?.();
    expect(revalidate).toHaveBeenCalledOnce();

    stop();
    expect(stopRoute).toHaveBeenCalledOnce();
    expect(stopActivation).toHaveBeenCalledOnce();
    expect(stopObservation).toHaveBeenCalledOnce();
    for (const dispose of stops) expect(dispose).toHaveBeenCalledOnce();
  });
});
