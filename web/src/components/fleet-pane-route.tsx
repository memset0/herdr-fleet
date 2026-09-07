import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRevalidator } from "react-router";

import { FleetTerminal } from "@/components/fleet-terminal";
import type { PaneContentProps } from "@/components/agent-chat";
import { paneLoader, type PaneData } from "@/lib/loaders";
import { internScope, scopeFromUrl } from "@/lib/scope";
import { DetailRoute } from "@/routes/detail";
import {
  DEFAULT_PANE_SURFACE,
  paneSurfaceStore,
  type PaneSurface,
} from "../../../fleet/ui/terminal/switch.ts";

/** The browser-local switch replaces only the native Pane's body, never its header or route. */
function terminalContent(props: PaneContentProps) {
  return <FleetTerminal {...props} />;
}

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


export function FleetPaneRoute() {
  const surface = usePaneSurface();
  const previous = useRef(surface);
  const { revalidate } = useRevalidator();
  useEffect(() => {
    if (previous.current === surface) return;
    previous.current = surface;
    void revalidate();
  }, [surface, revalidate]);
  return <DetailRoute renderContent={surface === "terminal" ? terminalContent : undefined} />;
}
