import { useSyncExternalStore } from "react";
import { useLoaderData, useNavigate } from "react-router";

import { FleetTerminal } from "@/components/fleet-terminal";
import { paneLoader, type PaneData } from "@/lib/loaders";
import { homePath } from "@/lib/nav";
import { findPane } from "@/lib/hosts";
import { useRootData } from "@/lib/route-data";
import { paneDisplayName } from "@/lib/types";
import { internScope, scopeFromUrl } from "@/lib/scope";
import { DetailRoute } from "@/routes/detail";
import {
  DEFAULT_PANE_SURFACE,
  paneSurfaceStore,
  type PaneSurface,
} from "../../../fleet/ui/terminal/switch.ts";

/**
 * Which surface a Pane is drawn as, decided downstream of Collie's own route.
 *
 * The choice is made HERE, in a fork-owned element and a fork-owned loader the router points at,
 * rather than inside Collie's pane page. The page would have had to grow a branch around everything
 * it does, and the loader would have had to fetch a mirror nobody was going to draw. This way the
 * mirror route is exactly the route it was: with the switch off, Collie's own element renders and
 * Collie's own loader runs, unchanged and un-wrapped in any observable way.
 *
 * The stored switch decides, and nothing else may. A surface named in an address or carried in
 * navigation state is not read at all: a link that could put a browser into the terminal surface
 * would be a link that types into someone's terminal.
 */

/** Subscribe to the one switch. The server-render fallback is the default, as everywhere else. */
export function usePaneSurface(): PaneSurface {
  return useSyncExternalStore(
    paneSurfaceStore.subscribe,
    paneSurfaceStore.snapshot,
    () => DEFAULT_PANE_SURFACE,
  );
}

/**
 * The Pane route's data while the terminal is on.
 *
 * Deliberately not a fetch. The mirror's text is the one thing this surface does not draw, and
 * asking for it would put a read of every Pane on the poll loop for a screen nobody is looking at.
 * The shape is `PaneData` because one thing above still reads it: the root layout dates the
 * connection banner from the MIRROR when a stale one is on screen, and this shape (no error, no
 * text) is exactly the "fall through to the herd's own stamp" case it already handles.
 */
export function terminalPaneData({
  params,
  request,
}: {
  params: { paneId?: string };
  request?: Request;
}): PaneData {
  const { paneId } = params;
  if (!paneId) throw new Error("fleetPaneLoader: missing :paneId route param");
  return {
    paneId,
    scope: internScope(scopeFromUrl(request?.url)),
    text: "",
    truncated: false,
    requestedLines: 0,
    revision: 0,
    error: false,
    authError: false,
  };
}

export async function fleetPaneLoader(args: {
  params: { paneId?: string };
  request?: Request;
}): Promise<PaneData> {
  if (paneSurfaceStore.snapshot() !== "terminal") return paneLoader(args);
  return terminalPaneData(args);
}

function FleetTerminalRoute() {
  // SAFETY: this element is reached only through `fleetPaneLoader`, which returns `PaneData` on both
  // of its branches; React Router types a data-mode `useLoaderData()` as `unknown`.
  const pane = useLoaderData() as PaneData;
  const root = useRootData();
  const navigate = useNavigate();
  const agent =
    findPane(root.agents, pane.paneId, pane.scope, root.servers, root.sessions) ??
    findPane(root.shellPanes, pane.paneId, pane.scope, root.servers, root.sessions);
  return (
    <FleetTerminal
      paneId={pane.paneId}
      scope={pane.scope}
      label={agent === undefined ? undefined : paneDisplayName(agent)}
      device={root.device}
      onBack={() => navigate(homePath(pane.scope))}
    />
  );
}

export function FleetPaneRoute() {
  const surface = usePaneSurface();
  if (surface !== "terminal") return <DetailRoute />;
  return <FleetTerminalRoute />;
}
