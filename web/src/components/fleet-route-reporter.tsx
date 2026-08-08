import { useEffect } from "react";
import { useLocation } from "react-router";

import { fleetRouteMessage, postFleetRoute } from "@/lib/fleet-route";

/** Reports only canonical home/Pane state to an authenticated Fleet parent. */
export function FleetRouteReporter() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    postFleetRoute(fleetRouteMessage(pathname, search), window.parent, window.parent !== window);
  }, [pathname, search]);

  return null;
}
