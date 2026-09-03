import type { FleetClientContext } from "./context.ts";
import { fleetDesktopTerminalUrl } from "../model/navigation.ts";

export function installSelection(ctx: FleetClientContext): void {
  ctx.services.updateHealth = function (node) {
    const healthy = node.health === "online";
    ctx.elements.notice.hidden = healthy;
    if (!healthy) {
      const detail = node.message ? " · " + node.message : "";
      ctx.elements.noticeText.textContent =
        node.name + " · " + ctx.services.healthLabel(node.health) + detail;
    }
  };

  ctx.services.terminalHref = function (node) {
    if (!node) return null;
    const route = ctx.state.frameRegistry.get(node.id)?.route;
    let pane: string | undefined;
    let session: string | undefined;
    if (route?.view === "pane") {
      pane = ctx.services.validPane(route.paneId) ?? undefined;
      session = route.session
        ? ctx.services.validTerminalSession(route.session)
        : undefined;
      if (!pane || (route.session && !session)) return null;
    }
    return fleetDesktopTerminalUrl(
      true,
      ctx.runtime.location.origin,
      node.id,
      pane,
      session,
    );
  };

  ctx.services.syncTerminalEntry = function () {
    let link = ctx.elements.hostRailFooter.querySelector<HTMLAnchorElement>(
      "[data-terminal-entry]",
    );
    const node = ctx.services.selectedNode();
    const href = ctx.terminalDesktopMedia.matches
      ? ctx.services.terminalHref(node)
      : null;
    if (!href) {
      if (link) link.remove();
      return;
    }
    if (!link) {
      link = ctx.services.element(
        "a",
        "desktop-terminal-entry",
        "Emergency terminal",
      ) as HTMLAnchorElement;
      link.dataset.terminalEntry = "true";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.referrerPolicy = "same-origin";
      ctx.elements.hostRailFooter.insertBefore(
        link,
        ctx.elements.settingsAnchor,
      );
    }
    link.href = href;
    link.title = "Open " + node.name + " emergency terminal";
    link.setAttribute(
      "aria-label",
      "Open " + node.name + " emergency terminal in a new tab",
    );
  };

  ctx.services.loadSelected = function (force = false, routeOverride = null) {
    const node = ctx.services.selectedNode();
    if (!node) return;
    const entry = ctx.services.ensureFrame(node);
    let route = routeOverride || entry.route || { view: "home" };
    if (route.invalid) route = { view: "home" };
    else if (route.view === "pane")
      route = ctx.services.canonicalPaneRoute(
        route.paneId,
        route.session,
        route.spaceId,
        route.tabId,
      );
    const href = ctx.services.frameHref(entry.origin, route);
    const nextFrameKey = ctx.services.routeKey(entry.origin, route);
    entry.route = route;
    ctx.services.syncCurrentAgentControl();
    entry.frame.title = "Collie · " + node.name;
    ctx.elements.openNode.href = href;
    ctx.elements.openNode.hidden = false;
    ctx.services.updateHealth(node);
    ctx.services.syncTerminalEntry();
    if (force || entry.frameKey !== nextFrameKey) {
      entry.frameKey = nextFrameKey;
      entry.loading = true;
      entry.frame.src = href;
    }
    ctx.services.showOnlyFrame(entry);
    ctx.services.replaceUrl(node.id, route);
  };

  ctx.services.selectNode = function (id, options = {}) {
    const node = ctx.state.nodes.find((candidate) => candidate.id === id);
    if (!node) return;
    const existing = ctx.state.frameRegistry.get(id);
    const supplied =
      options.route &&
      (options.route.view === "pane" || options.route.view === "home")
        ? options.route
        : null;
    let route =
      supplied ||
      (options.routeFromUrl
        ? ctx.services.requestedRoute()
        : existing?.route || { view: "home" });
    route = route.invalid
      ? { view: "home" }
      : route.view === "pane"
        ? ctx.services.canonicalPaneRoute(
            route.paneId,
            route.session,
            route.spaceId,
            route.tabId,
          )
        : route;
    ctx.services.cancelDialogsForRoute(id, route);
    ctx.state.selectedId = id;
    ctx.services.remember(id);
    const entry = ctx.services.ensureFrame(node);
    entry.route = route;
    ctx.services.visitFrame(entry);
    ctx.services.replaceUrl(id, route);
    ctx.services.syncCurrentAgentControl();
    ctx.services.recordPaneFocus(id, route);
    ctx.services.renderTabs(options.focusTreeKey || Boolean(options.focusTab));
    ctx.services.loadSelected(Boolean(options.forceFrame), route);
    ctx.services.announce(
      "Selected " +
        node.name +
        ". " +
        ctx.services.healthLabel(node.health) +
        ".",
    );
  };

  ctx.services.selectTreeNode = function (id, options = {}) {
    const compactTree = ctx.state.treeOpen && !ctx.desktopMedia.matches;
    ctx.services.selectNode(
      id,
      compactTree ? { ...options, focusTreeKey: false } : options,
    );
    if (compactTree) ctx.services.closeTreeMenu({ restoreFocus: true });
  };

  ctx.services.showEmpty = function (title, copy) {
    ctx.services.closeCommandDialog();
    ctx.services.cancelSpaceClose();
    ctx.services.closeTreeContextMenu();
    for (const id of [...ctx.state.frameRegistry.keys()])
      ctx.services.releaseFrame(id, true);
    ctx.state.selectedId = null;
    ctx.elements.hostSwitcher.replaceChildren();
    ctx.elements.instances.replaceChildren();
    ctx.services.syncCurrentAgentControl();
    ctx.elements.openNode.hidden = true;
    ctx.elements.notice.hidden = true;
    ctx.elements.loading.hidden = true;
    ctx.services.syncTerminalEntry();
    ctx.elements.emptyTitle.textContent = title;
    ctx.elements.emptyCopy.textContent = copy;
    ctx.elements.empty.hidden = false;
    ctx.services.announce(title + ". " + copy);
  };
}
