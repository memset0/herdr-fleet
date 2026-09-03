import * as constants from "./constants.ts";
import type { FleetClientContext } from "./context.ts";
import { fleetRefreshWaitMs } from "../model/refresh.ts";

export function installRefresh(ctx: FleetClientContext): void {
  ctx.services.currentRouteAuthoritativelyMissing = function () {
    const entry = ctx.services.activeEntry();
    const route = entry?.route;
    const node = ctx.services.selectedNode();
    if (!entry || !node || route?.view !== "pane") return false;
    const session = route.session || "";
    const tree = (
      Array.isArray(node.treeSessions) ? node.treeSessions : []
    ).find(
      (candidate: any) =>
        candidate &&
        ((candidate.primarySession === true && session === "") ||
          (candidate.primarySession !== true &&
            candidate.herdrSession === session)),
    );
    if (!tree || tree.reachable !== true) return false;
    for (const space of Array.isArray(tree.spaces) ? tree.spaces : []) {
      for (const tab of Array.isArray(space.tabs) ? space.tabs : []) {
        if (route.tabId && tab.tabId !== route.tabId) continue;
        if (
          (Array.isArray(tab.panes) ? tab.panes : []).some(
            (pane: any) => pane?.paneId === route.paneId,
          )
        )
          return false;
      }
    }
    return true;
  };

  ctx.services.renderInventory = function (data) {
    ctx.state.nodes = Array.isArray(data.nodes)
      ? data.nodes.filter(
          (node: any) =>
            node &&
            typeof node.id === "string" &&
            typeof node.name === "string" &&
            typeof node.publicHost === "string",
        )
      : [];
    ctx.services.reconcileFrames();
    ctx.services.prunePaneMru();
    if (ctx.services.currentRouteAuthoritativelyMissing()) {
      const entry = ctx.services.activeEntry();
      if (entry) {
        ctx.services.cancelDialogsForRoute(entry.id, { view: "home" });
        entry.route = { view: "home" };
        entry.frameKey = null;
        ctx.services.replaceUrl(entry.id, entry.route);
      }
    }
    ctx.services.renderAgents();
    if (!ctx.state.nodes.length) {
      ctx.services.showEmpty(
        "No instances",
        "No enabled Herdr instances are configured.",
      );
      return;
    }
    const choice = ctx.services.chooseNode();
    if (!choice) {
      ctx.services.showEmpty(
        "No instances",
        "No enabled Herdr instances are configured.",
      );
      return;
    }
    if (choice.id !== ctx.state.selectedId)
      ctx.services.selectNode(choice.id, {
        routeFromUrl: ctx.services.requested() === choice.id,
      });
    else {
      ctx.services.renderTabs();
      ctx.services.loadSelected(false);
    }
  };

  ctx.services.syncTreePresentation = function () {
    const hidden = !ctx.desktopMedia.matches && !ctx.state.treeOpen;
    ctx.elements.instances.inert = hidden;
    ctx.elements.instances.setAttribute("aria-hidden", String(hidden));
  };

  ctx.services.closeTreeMenu = function (options = {}) {
    if (!ctx.desktopMedia.matches && !ctx.elements.settingsPopover.hidden)
      ctx.services.closeSettings();
    ctx.state.treeOpen = false;
    delete ctx.elements.shell.dataset.treeOpen;
    ctx.elements.treeMenuBackdrop.hidden = true;
    ctx.elements.treeMenuToggle.setAttribute("aria-expanded", "false");
    ctx.elements.treeMenuToggle.setAttribute("aria-label", "Open Host tree");
    ctx.services.syncTreePresentation();
    if (options.restoreFocus && !ctx.desktopMedia.matches)
      ctx.elements.treeMenuToggle.focus();
    if (options.syncActivity !== false) ctx.services.broadcastFrameActivity();
  };

  ctx.services.openTreeMenu = function () {
    if (ctx.desktopMedia.matches) return;
    ctx.services.closeAgentMenu({ syncActivity: false });
    ctx.state.treeOpen = true;
    ctx.elements.shell.dataset.treeOpen = "true";
    ctx.elements.treeMenuBackdrop.hidden = false;
    ctx.elements.treeMenuToggle.setAttribute("aria-expanded", "true");
    ctx.elements.treeMenuToggle.setAttribute("aria-label", "Close Host tree");
    ctx.services.broadcastFrameActivity();
    ctx.services.syncTreePresentation();
  };

  ctx.services.closeAgentMenu = function (options = {}) {
    if (ctx.desktopMedia.matches) return;
    ctx.elements.agentMenu.hidden = true;
    ctx.elements.agentMenuToggle.setAttribute("aria-expanded", "false");
    if (options.syncActivity !== false) ctx.services.broadcastFrameActivity();
  };

  ctx.services.openAgentMenu = function () {
    ctx.services.closeTreeMenu({ syncActivity: false });
    ctx.elements.agentMenu.hidden = false;
    ctx.elements.agentMenuToggle.setAttribute("aria-expanded", "true");
    ctx.services.renderAgents();
    ctx.services.broadcastFrameActivity();
    void ctx.services.refresh({ manual: true });
  };

  ctx.services.syncAgentMenuLayout = function () {
    const nextDesktop = ctx.desktopMedia.matches;
    if (nextDesktop) {
      ctx.services.closeTreeMenu();
      ctx.elements.agentMenu.hidden = false;
      ctx.elements.agentMenuToggle.setAttribute("aria-expanded", "false");
    } else if (ctx.state.desktopMode) {
      ctx.services.closeSettings();
      ctx.services.closeCommandDialog();
      ctx.services.cancelSpaceClose();
      ctx.services.closeTreeContextMenu();
      ctx.services.setSidebarsCollapsed(false);
      ctx.elements.agentMenu.hidden = true;
      ctx.elements.agentMenuToggle.setAttribute("aria-expanded", "false");
    }
    ctx.state.desktopMode = nextDesktop;
    ctx.services.renderAgents();
    ctx.services.syncTreePresentation();
    ctx.services.renderTabs();
    ctx.services.syncTerminalEntry();
    ctx.services.applyRailWidthPreferences();
    ctx.services.broadcastFrameActivity();
  };

  ctx.services.clearRefreshTimer = function () {
    if (ctx.state.refreshTimer !== null) {
      ctx.runtime.clearTimeout(ctx.state.refreshTimer);
      ctx.state.refreshTimer = null;
    }
  };
  ctx.services.scheduleRefresh = function (waitMs) {
    const delay = Number.isSafeInteger(waitMs)
      ? Math.max(constants.MIN_REFRESH_TIMER_MS, waitMs)
      : constants.DEFAULT_REFRESH_MS;
    ctx.services.clearRefreshTimer();
    ctx.elements.agentRefreshState.textContent =
      "Next refresh in " + ctx.services.formatDelay(delay);
    ctx.state.refreshTimer = ctx.runtime.setTimeout(() => {
      ctx.state.refreshTimer = null;
      void ctx.services.refresh();
    }, delay);
  };

  ctx.services.refresh = async function (options = {}) {
    const manual = Boolean(options.manual);
    if (manual) ctx.services.clearRefreshTimer();
    if (ctx.state.refreshing) {
      if (manual) ctx.state.queuedManualRefresh = true;
      return;
    }
    ctx.state.refreshing = true;
    ctx.elements.agentRefreshState.textContent = "Refreshing…";
    let nextWaitMs = constants.DEFAULT_REFRESH_MS;
    try {
      const response = await ctx.runtime.fetch(
        manual ? "/api/fleet?manual=1" : "/api/fleet",
        { headers: { accept: "application/json" }, cache: "no-store" },
      );
      if (response.status === 401) {
        ctx.runtime.location.assign(
          "/auth/login?next=" + encodeURIComponent(ctx.runtime.location.href),
        );
        return;
      }
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      const generatedAt = Number.isSafeInteger(data.generatedAt)
        ? data.generatedAt
        : null;
      const nextAt =
        data.refresh && Number.isSafeInteger(data.refresh.nextAt)
          ? data.refresh.nextAt
          : null;
      if (generatedAt !== null && nextAt !== null)
        nextWaitMs = fleetRefreshWaitMs(
          nextAt,
          generatedAt,
          constants.DEFAULT_REFRESH_MS,
        );
      ctx.services.renderInventory(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!ctx.state.nodes.length)
        ctx.services.showEmpty(
          "Fleet unavailable",
          "Could not load instance inventory. " + message,
        );
      ctx.services.announce("Fleet refresh failed. " + message);
    } finally {
      ctx.state.refreshing = false;
      if (ctx.state.queuedManualRefresh) {
        ctx.state.queuedManualRefresh = false;
        void ctx.services.refresh({ manual: true });
        return;
      }
      ctx.services.scheduleRefresh(nextWaitMs);
    }
  };
}
