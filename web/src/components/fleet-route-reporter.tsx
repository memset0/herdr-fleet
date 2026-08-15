import { useEffect } from "react";
import { useLocation } from "react-router";

import { fleetRouteMessage, postFleetRoute } from "@/lib/fleet-route";
import type { AgentView } from "@/lib/types";

/** Reports only canonical home/Pane state to an authenticated Fleet parent. */
export function FleetRouteReporter({
  agents,
  shellPanes,
}: {
  agents: readonly AgentView[];
  shellPanes: readonly AgentView[];
}) {
  const { pathname, search } = useLocation();
  const encodedPane = /^\/pane\/([^/]+)/.exec(pathname)?.[1];
  let paneId: string | undefined;
  try {
    paneId = encodedPane ? decodeURIComponent(encodedPane) : undefined;
  } catch {
    paneId = undefined;
  }
  const pane = agents.find((candidate) => candidate.paneId === paneId)
    ?? shellPanes.find((candidate) => candidate.paneId === paneId);
  const spaceId = pane?.workspaceId;
  const tabId = pane?.tabId;

  useEffect(() => {
    postFleetRoute(
      fleetRouteMessage(
        pathname,
        search,
        paneId && spaceId && tabId ? { paneId, workspaceId: spaceId, tabId } : undefined,
      ),
      window.parent,
      window.parent !== window,
    );
  }, [pathname, search, paneId, spaceId, tabId]);

  return null;
}
