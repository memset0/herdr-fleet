import type { DataRouter } from "react-router";

import { registerPaneObservationProvider } from "@/lib/api";
import { ROOT_ROUTE_ID, type HomeData } from "@/lib/loaders";
import { startFleetActions } from "./actions";
import {
  paneObservationActive,
  startFleetActivity,
  subscribeFleetActivation,
} from "./activity";
import { isFleetFrame } from "./frame";
import {
  fleetRouteMessage,
  postFleetRoute,
  type FleetPaneLocation,
  type FleetRouteMessage,
} from "./route";
import { startFleetShortcuts } from "./shortcuts";

type FleetRouter = Pick<DataRouter, "state" | "subscribe" | "revalidate">;
type RouterState = DataRouter["state"];

export interface FleetAdapterServices {
  startActivity(): () => void;
  startActions(): () => void;
  startShortcuts(): () => void;
  registerObservation(provider: () => boolean): () => void;
  subscribeActivation(listener: () => void): () => void;
  report(message: FleetRouteMessage): void;
}

const browserServices: FleetAdapterServices = {
  startActivity: startFleetActivity,
  startActions: startFleetActions,
  startShortcuts: startFleetShortcuts,
  registerObservation: registerPaneObservationProvider,
  subscribeActivation: subscribeFleetActivation,
  report: (message) => {
    postFleetRoute(message, window.parent, isFleetFrame());
  },
};

function homeData(state: RouterState): Partial<HomeData> | undefined {
  const value: unknown = state.loaderData[ROOT_ROUTE_ID];
  return value && typeof value === "object"
    ? (value as Partial<HomeData>)
    : undefined;
}

function paneLocation(state: RouterState, paneId: string): FleetPaneLocation | undefined {
  const data = homeData(state);
  const panes = [
    ...(Array.isArray(data?.agents) ? data.agents : []),
    ...(Array.isArray(data?.shellPanes) ? data.shellPanes : []),
  ];
  const pane = panes.find((candidate) => candidate.paneId === paneId);
  return pane
    ? {
        paneId: pane.paneId,
        workspaceId: pane.workspaceId,
        tabId: pane.tabId,
      }
    : undefined;
}

export function fleetRouteForRouterState(state: RouterState): FleetRouteMessage {
  const { pathname, search } = state.location;
  const encodedPane = /^\/pane\/([^/]+)/.exec(pathname)?.[1];
  let paneId: string | undefined;
  try {
    paneId = encodedPane ? decodeURIComponent(encodedPane) : undefined;
  } catch {
    paneId = undefined;
  }
  return fleetRouteMessage(
    pathname,
    search,
    paneId ? paneLocation(state, paneId) : undefined,
  );
}

/** Own the complete framed Collie lifecycle behind one App-level port. */
export function startFleetAdapter(
  router: FleetRouter,
  services: FleetAdapterServices = browserServices,
): () => void {
  const stopActivity = services.startActivity();
  const stopObservation = services.registerObservation(() => paneObservationActive());
  const stopActions = services.startActions();
  const stopShortcuts = services.startShortcuts();
  const stopActivation = services.subscribeActivation(() => router.revalidate());
  const report = (state: RouterState) => services.report(fleetRouteForRouterState(state));
  const stopRoute = router.subscribe((state) => report(state));
  report(router.state);

  return () => {
    stopRoute();
    stopActivation();
    stopObservation();
    stopShortcuts();
    stopActions();
    stopActivity();
  };
}
