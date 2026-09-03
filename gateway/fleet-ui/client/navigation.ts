import type { FleetClientContext } from "./context.ts";

export function installNavigation(ctx: FleetClientContext): void {
  ctx.services.focusSelectedFrame = function () {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const entry = ctx.services.activeEntry();
        if (!entry || entry.frame.hidden) return;
        try {
          entry.frame.focus({ preventScroll: true });
        } catch {
          entry.frame.focus();
        }
      }),
    );
  };

  ctx.services.routeIdentity = function (nodeId, route) {
    if (
      !nodeId ||
      route?.view !== "pane" ||
      !route.spaceId ||
      !route.tabId ||
      !route.paneId
    )
      return null;
    return {
      nodeId,
      route: {
        view: "pane",
        spaceId: route.spaceId,
        tabId: route.tabId,
        paneId: route.paneId,
        ...(route.session ? { session: route.session } : {}),
      },
      key: [
        nodeId,
        route.session || "",
        route.spaceId,
        route.tabId,
        route.paneId,
      ].join("|"),
    };
  };

  ctx.services.recordPaneFocus = function (nodeId, route) {
    const identity = ctx.services.routeIdentity(nodeId, route);
    if (!identity) return;
    ctx.state.paneMru = [
      identity,
      ...ctx.state.paneMru.filter((entry) => entry.key !== identity.key),
    ].slice(0, 2);
  };

  ctx.services.paneIdentityState = function (identity) {
    const node = ctx.state.nodes.find(
      (candidate) => candidate.id === identity.nodeId,
    );
    if (!node) return "missing";
    const route = identity.route;
    const session = route.session || "";
    const tree = (
      Array.isArray(node.treeSessions) ? node.treeSessions : []
    ).find(
      (candidate) =>
        candidate &&
        ((candidate.primarySession === true && session === "") ||
          (candidate.primarySession !== true &&
            candidate.herdrSession === session)),
    );
    if (!tree || tree.reachable !== true) return "unknown";
    const space = (Array.isArray(tree.spaces) ? tree.spaces : []).find(
      (candidate) => candidate?.workspaceId === route.spaceId,
    );
    const tab = (Array.isArray(space?.tabs) ? space.tabs : []).find(
      (candidate) => candidate?.tabId === route.tabId,
    );
    return (Array.isArray(tab?.panes) ? tab.panes : []).some(
      (pane) => pane?.paneId === route.paneId,
    )
      ? "present"
      : "missing";
  };

  ctx.services.prunePaneMru = function () {
    ctx.state.paneMru = ctx.state.paneMru
      .filter(
        (identity) => ctx.services.paneIdentityState(identity) !== "missing",
      )
      .slice(0, 2);
  };

  ctx.services.treeFocusKeyForRoute = function (nodeId, route, paneCount = 2) {
    return ctx.services.treeKey(
      nodeId,
      route.session || "",
      paneCount <= 1 ? "tab" : "pane",
      paneCount <= 1 ? route.tabId : route.paneId,
    );
  };

  ctx.services.selectCanonicalPaneTarget = function (
    nodeId,
    route,
    paneCount = 2,
    childOriginated = false,
  ) {
    const identity = ctx.services.routeIdentity(nodeId, route);
    if (!identity) return false;
    ctx.services.selectTreeNode(nodeId, {
      route: identity.route,
      focusTreeKey: ctx.services.treeFocusKeyForRoute(
        nodeId,
        identity.route,
        paneCount,
      ),
    });
    if (childOriginated) ctx.services.focusSelectedFrame();
    return true;
  };

  ctx.services.cyclePaneShortcut = function (delta, childOriginated = false) {
    const entry = ctx.services.activeEntry();
    const route = entry?.route;
    if (!entry || route?.view !== "pane") {
      ctx.services.showTreeActionStatus(
        "No current Pane is available for keyboard navigation.",
        "error",
      );
      return false;
    }
    const currentKey = ctx.services.shortcutPaneKey(
      entry.id,
      route.paneId,
      route.session || "",
    );
    const index = ctx.state.paneShortcutTargets.findIndex(
      (target) => target.key === currentKey,
    );
    if (index < 0 || ctx.state.paneShortcutTargets.length === 0) {
      ctx.services.showTreeActionStatus(
        "The current Pane is not in the Fleet tree.",
        "error",
      );
      return false;
    }
    const target =
      ctx.state.paneShortcutTargets[
        (index + delta + ctx.state.paneShortcutTargets.length) %
          ctx.state.paneShortcutTargets.length
      ];
    ctx.services.selectTreeNode(target.nodeId, {
      route: target.route,
      focusTreeKey: target.treeKey,
    });
    if (childOriginated) ctx.services.focusSelectedFrame();
    return true;
  };

  ctx.services.selectAgentShortcut = function (
    ordinal,
    childOriginated = false,
  ) {
    const target = ctx.state.agentShortcutTargets[ordinal - 1];
    if (!target) {
      ctx.services.showTreeActionStatus(
        "Agent shortcut " + ordinal + " is unavailable.",
        "error",
      );
      return false;
    }
    ctx.services.selectAgent(target.node, target.agent);
    if (childOriginated) ctx.services.focusSelectedFrame();
    return true;
  };

  ctx.services.cycleAgentShortcut = function (delta, childOriginated = false) {
    if (!ctx.state.agentShortcutTargets.length) {
      ctx.services.showTreeActionStatus(
        "No Agents are available for keyboard navigation.",
        "error",
      );
      return false;
    }
    const route =
      ctx.services.activeEntry()?.route || ctx.services.requestedRoute();
    const currentKey =
      route?.view === "pane"
        ? (route.nodeId || ctx.state.selectedId) +
          "|" +
          (route.paneId || "") +
          "|" +
          (route.session || "")
        : null;
    const index = currentKey
      ? ctx.state.agentShortcutTargets.findIndex(
          (entry) =>
            entry.node.id +
              "|" +
              entry.agent.paneId +
              "|" +
              (entry.agent.primarySession ? "" : entry.agent.herdrSession) ===
            currentKey,
        )
      : -1;
    let target;
    if (index >= 0)
      target =
        ctx.state.agentShortcutTargets[
          (index + delta + ctx.state.agentShortcutTargets.length) %
            ctx.state.agentShortcutTargets.length
        ];
    else
      target =
        delta > 0
          ? ctx.state.agentShortcutTargets[0]
          : ctx.state.agentShortcutTargets[
              ctx.state.agentShortcutTargets.length - 1
            ];
    ctx.services.selectAgent(target.node, target.agent);
    if (childOriginated) ctx.services.focusSelectedFrame();
    return true;
  };

  ctx.services.navigateTab = function (commandId, childOriginated = false) {
    const context = ctx.services.currentTreeContext();
    if (!context) return false;
    const tabs = (
      Array.isArray(context.space.tabs) ? context.space.tabs : []
    ).filter(
      (tab: any) =>
        ctx.services.validPane(tab?.tabId) &&
        ctx.services.validTabPanes(tab).length,
    );
    if (!tabs.length) return false;
    let index;
    const ordinal = /^select-tab-([1-9])$/.exec(commandId);
    if (ordinal) index = Number(ordinal[1]) - 1;
    else {
      const current = tabs.findIndex(
        (tab: any) => tab.tabId === context.route.tabId,
      );
      if (current < 0) return false;
      index =
        (current + (commandId === "next-tab" ? 1 : -1) + tabs.length) %
        tabs.length;
    }
    const tab = tabs[index];
    if (!tab) return false;
    const panes = ctx.services.validTabPanes(tab);
    const selected =
      panes.find(({ pane }: any) => pane?.focused === true) || panes[0];
    if (!selected) return false;
    return ctx.services.selectCanonicalPaneTarget(
      context.node.id,
      {
        view: "pane",
        spaceId: context.route.spaceId,
        tabId: tab.tabId,
        paneId: selected.paneId,
        ...(context.session ? { session: context.session } : {}),
      },
      panes.length,
      childOriginated,
    );
  };

  ctx.services.navigatePaneInTab = function (delta, childOriginated = false) {
    const context = ctx.services.currentTreeContext();
    if (!context) return false;
    const panes = ctx.services.validTabPanes(context.tab);
    if (!panes.length) return false;
    const current = panes.findIndex(
      ({ paneId }: any) => paneId === context.route.paneId,
    );
    if (current < 0) return false;
    const selected = panes[(current + delta + panes.length) % panes.length];
    return ctx.services.selectCanonicalPaneTarget(
      context.node.id,
      { ...context.route, paneId: selected.paneId },
      panes.length,
      childOriginated,
    );
  };

  ctx.services.navigateLastPane = function (childOriginated = false) {
    ctx.services.prunePaneMru();
    const current = ctx.services.routeIdentity(
      ctx.state.selectedId,
      ctx.services.activeEntry()?.route,
    );
    const target = ctx.state.paneMru.find(
      (identity) => identity.key !== current?.key,
    );
    if (!target) return false;
    return ctx.services.selectCanonicalPaneTarget(
      target.nodeId,
      target.route,
      2,
      childOriginated,
    );
  };
}
