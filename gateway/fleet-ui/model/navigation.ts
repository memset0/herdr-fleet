export function fleetShortcutCycleIndex(
  targetKeys: readonly string[],
  currentKey: string,
  delta: -1 | 1,
): number | null {
  if (targetKeys.length === 0) return null;
  const currentIndex = targetKeys.indexOf(currentKey);
  if (currentIndex < 0) return null;
  return (currentIndex + delta + targetKeys.length) % targetKeys.length;
}

export type FleetTreeTabMode = "empty" | "direct" | "branch";

export function fleetTreeTabMode(
  panes: readonly { paneId?: unknown }[],
): FleetTreeTabMode {
  const ids = new Set<string>();
  for (const pane of panes) {
    if (
      typeof pane.paneId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(pane.paneId)
    )
      continue;
    ids.add(pane.paneId);
  }
  if (ids.size === 0) return "empty";
  return ids.size === 1 ? "direct" : "branch";
}

export interface FleetPaneRouteIdentity {
  nodeId: string;
  view: "home" | "pane";
  paneId?: string;
  tabId?: string;
  session?: string;
}

export interface FleetAgentRouteIdentity {
  nodeId: string;
  paneId: string;
  herdrSession?: string;
  primarySession?: boolean;
}

/** Exact current-row identity. Primary sessions normalize to the empty wire/session value. */
export function fleetCurrentAgentMatch(
  route: FleetPaneRouteIdentity | null,
  agent: FleetAgentRouteIdentity,
): boolean {
  return (
    route?.view === "pane" &&
    route.nodeId === agent.nodeId &&
    route.paneId === agent.paneId &&
    (route.session ?? "") ===
      (agent.primarySession ? "" : (agent.herdrSession ?? ""))
  );
}

export type FleetCloseTargetIdentity =
  | { nodeId: string; kind: "pane"; targetId: string; session?: string }
  | {
      nodeId: string;
      kind: "tab";
      targetId: string;
      paneIds: readonly string[];
      session?: string;
    };

export function fleetCloseAffectsRoute(
  route: FleetPaneRouteIdentity | null,
  target: FleetCloseTargetIdentity,
): boolean {
  if (
    route?.view !== "pane" ||
    route.nodeId !== target.nodeId ||
    (route.session ?? "") !== (target.session ?? "")
  ) {
    return false;
  }
  if (target.kind === "pane") return route.paneId === target.targetId;
  return (
    route.tabId === target.targetId ||
    Boolean(route.paneId && target.paneIds.includes(route.paneId))
  );
}

/** Fleet derives the emergency entry from its own origin and current exact Pane route. */
export function fleetDesktopTerminalUrl(
  desktop: boolean,
  fleetOrigin: string,
  nodeId: string,
  paneId?: string,
  session?: string,
): string | null {
  if (!desktop || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(nodeId))
    return null;
  if (
    paneId !== undefined &&
    !/^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/.test(paneId)
  )
    return null;
  if (
    session !== undefined &&
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(session)
  )
    return null;
  try {
    const origin = new URL(fleetOrigin);
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.port ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    )
      return null;
    const url = new URL(`/ttyd/${encodeURIComponent(nodeId)}/`, origin);
    if (paneId) url.searchParams.set("pane", paneId);
    if (session) url.searchParams.set("session", session);
    return url.href;
  } catch {
    return null;
  }
}
