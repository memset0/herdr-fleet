import type { FleetClientContext } from "./context.ts";

export function installRoutes(ctx: FleetClientContext): void {
  ctx.services.requestedRoute = function () {
    const params = new URL(ctx.runtime.location.href).searchParams;
    const rawSpace = params.get("space");
    const rawTab = params.get("tab");
    const rawPane = params.get("pane");
    const rawSession = params.get("session");
    const spaceId = ctx.services.validPane(rawSpace);
    const tabId = ctx.services.validPane(rawTab);
    const paneId = ctx.services.validPane(rawPane);
    const session = ctx.services.validSession(rawSession);
    const hasLocation = rawSpace !== null || rawTab !== null;
    const invalid =
      (rawPane !== null && !paneId) ||
      (rawSession !== null && !session) ||
      (hasLocation && (!paneId || !spaceId || !tabId));
    return {
      view: paneId ? "pane" : "home",
      ...(paneId ? { paneId } : {}),
      ...(spaceId && tabId ? { spaceId, tabId } : {}),
      ...(session ? { session } : {}),
      invalid,
    };
  };

  ctx.services.routeKey = (origin, route) =>
    origin +
    "|" +
    route.view +
    "|" +
    (route.paneId || "") +
    "|" +
    (route.session || "");

  ctx.services.canonicalPaneRoute = function (
    paneId,
    session,
    spaceId = null,
    tabId = null,
    nodeId = ctx.state.selectedId,
  ) {
    const route = { view: "pane", paneId, ...(session ? { session } : {}) };
    const node =
      ctx.state.nodes.find((candidate) => candidate.id === nodeId) || null;
    const match =
      node && Array.isArray(node.agentEntries)
        ? node.agentEntries.find(
            (agent) =>
              agent.paneId === paneId &&
              (session
                ? !agent.primarySession && agent.herdrSession === session
                : agent.primarySession),
          )
        : null;
    const matchedSpace = ctx.services.validPane(match && match.workspaceId);
    const matchedTab = ctx.services.validPane(match && match.tabId);
    if (matchedSpace && matchedTab)
      return { ...route, spaceId: matchedSpace, tabId: matchedTab };
    const safeSpace = ctx.services.validPane(spaceId);
    const safeTab = ctx.services.validPane(tabId);
    if (safeSpace && safeTab)
      return { ...route, spaceId: safeSpace, tabId: safeTab };
    if (nodeId === ctx.state.selectedId) {
      const current = ctx.services.requestedRoute();
      if (
        current.view === "pane" &&
        current.paneId === paneId &&
        (current.session || "") === (session || "") &&
        current.spaceId &&
        current.tabId
      )
        return { ...route, spaceId: current.spaceId, tabId: current.tabId };
    }
    return route;
  };

  ctx.services.frameHref = function (origin, route) {
    const url = new URL("/", origin);
    if (route.view === "pane")
      url.pathname = "/pane/" + encodeURIComponent(route.paneId);
    if (route.session) url.searchParams.set("s", route.session);
    return url.href;
  };

  ctx.services.replaceUrl = function (id, route) {
    const url = new URL(ctx.runtime.location.href);
    url.searchParams.set("instance", id);
    url.searchParams.delete("space");
    url.searchParams.delete("tab");
    url.searchParams.delete("pane");
    url.searchParams.delete("session");
    if (route.view === "pane") {
      if (route.spaceId && route.tabId) {
        url.searchParams.set("space", route.spaceId);
        url.searchParams.set("tab", route.tabId);
      }
      url.searchParams.set("pane", route.paneId);
    }
    if (route.session) url.searchParams.set("session", route.session);
    if (url.href === ctx.runtime.location.href) return;
    ctx.runtime.history.replaceState(null, "", url);
  };

  ctx.services.activeEntry = () =>
    ctx.state.selectedId
      ? ctx.state.frameRegistry.get(ctx.state.selectedId) || null
      : null;

  ctx.services.syncCurrentAgentControl = function () {
    const route = ctx.services.activeEntry()?.route || null;
    let matched = false;
    for (const control of Array.from(
      ctx.elements.agentSections.querySelectorAll<HTMLElement>(
        ".agent-card-main[data-agent-node]",
      ),
    )) {
      const current =
        !matched &&
        route?.view === "pane" &&
        control.dataset.agentNode === ctx.state.selectedId &&
        control.dataset.agentPane === route.paneId &&
        (control.dataset.agentSession || "") === (route.session || "");
      const card = control.closest<HTMLElement>(".agent-card");
      if (current) {
        matched = true;
        control.setAttribute("aria-current", "page");
        if (card) card.dataset.currentPane = "true";
      } else {
        control.removeAttribute("aria-current");
        if (card) delete card.dataset.currentPane;
      }
    }
  };
}
