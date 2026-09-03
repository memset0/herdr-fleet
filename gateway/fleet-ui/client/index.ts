import * as constants from "./constants.ts";
import {
  browserFleetRuntime,
  createFleetClientContext,
  initializeFleetClientState,
  type FleetClientContext,
  type FleetClientRuntime,
} from "./context.ts";
import { installCommon } from "./common.ts";
import { installShortcuts } from "./shortcuts.ts";
import { installSettings } from "./settings.ts";
import { installLayout } from "./layout.ts";
import { installFrames } from "./frames.ts";
import { installActions } from "./actions.ts";
import { installCommands } from "./commands.ts";
import { installCommandDispatch } from "./command-dispatch.ts";
import { installDialogs } from "./dialogs.ts";
import { installTree } from "./tree.ts";
import { installTreeActions } from "./tree-actions.ts";
import { installTreeRender } from "./tree-render.ts";
import { installAgents } from "./agents.ts";
import { installNavigation } from "./navigation.ts";
import { installRoutes } from "./routes.ts";
import { installSelection } from "./selection.ts";
import { installRefresh } from "./refresh.ts";

export function startFleetClient(
  runtime: FleetClientRuntime = browserFleetRuntime(),
): FleetClientContext {
  const ctx = createFleetClientContext(runtime);
  installCommon(ctx);
  installShortcuts(ctx);
  installSettings(ctx);
  installLayout(ctx);
  installRoutes(ctx);
  installFrames(ctx);
  installSelection(ctx);
  installActions(ctx);
  installCommands(ctx);
  installTreeActions(ctx);
  installDialogs(ctx);
  installTree(ctx);
  installTreeRender(ctx);
  installAgents(ctx);
  installNavigation(ctx);
  installCommandDispatch(ctx);
  installRefresh(ctx);
  initializeFleetClientState(ctx);
  ctx.elements.hostSwitcher.addEventListener("keydown", (event) => {
    if (
      ctx.desktopMedia.matches ||
      !(event.target as Element | null)?.closest(".host-switcher-tab")
    )
      return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const index = ctx.state.nodes.findIndex(
      (node) => node.id === ctx.state.selectedId,
    );
    if (index < 0) return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next =
      ctx.state.nodes[
        (index + delta + ctx.state.nodes.length) % ctx.state.nodes.length
      ];
    if (next) ctx.services.selectNode(next.id, { focusTab: true });
  });
  ctx.elements.treeMenuToggle.addEventListener("click", () => {
    if (ctx.state.treeOpen) ctx.services.closeTreeMenu({ restoreFocus: true });
    else ctx.services.openTreeMenu();
  });
  ctx.elements.treeMenuBackdrop.addEventListener("click", () =>
    ctx.services.closeTreeMenu({ restoreFocus: true }),
  );
  ctx.elements.agentMenuToggle.addEventListener("click", () => {
    if (ctx.elements.agentMenu.hidden) ctx.services.openAgentMenu();
    else ctx.services.closeAgentMenu();
  });
  ctx.elements.settingsToggle.addEventListener("click", () => {
    if (ctx.elements.settingsPopover.hidden)
      ctx.services.dispatchCommand("open-fleet-settings", { source: "ui" });
    else ctx.services.closeSettings({ restoreFocus: true });
  });
  ctx.elements.cacheSizeSelect.value = String(ctx.state.iframeCacheSize);
  ctx.elements.cacheSizeSelect.addEventListener("change", () =>
    ctx.services.setIframeCacheSize(ctx.elements.cacheSizeSelect.value),
  );
  ctx.elements.cacheReset.addEventListener("click", () => {
    try {
      ctx.runtime.storage.removeItem(constants.CACHE_STORAGE_KEY);
    } catch {}
    ctx.services.setIframeCacheSize(ctx.state.defaultCacheSize, {
      persist: false,
    });
  });
  ctx.elements.commandDialogInput.addEventListener("input", () => {
    if (ctx.state.commandDialogState?.mode === "palette")
      ctx.services.renderCommandPalette();
    else {
      ctx.elements.commandDialogError.hidden = true;
      ctx.elements.commandDialogError.textContent = "";
    }
  });
  ctx.elements.commandDialogCancel.addEventListener("click", () =>
    ctx.services.closeCommandDialog({ restoreFocus: true }),
  );
  ctx.elements.commandDialogBackdrop.addEventListener("click", () =>
    ctx.services.closeCommandDialog({ restoreFocus: true }),
  );
  ctx.elements.commandDialogForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (ctx.state.commandDialogState?.mode === "rename")
      void ctx.services.submitRename();
    else if (ctx.state.commandDialogState?.mode === "palette") {
      const command =
        ctx.state.commandDialogState.commands[
          ctx.state.commandDialogState.selectedIndex
        ];
      if (command) ctx.services.activatePaletteCommand(command.id);
    }
  });
  ctx.elements.spaceCloseBackdrop.addEventListener("click", () =>
    ctx.services.cancelSpaceClose({ restoreFocus: true }),
  );
  ctx.elements.spaceCloseCancel.addEventListener("click", () =>
    ctx.services.cancelSpaceClose({ restoreFocus: true }),
  );
  ctx.elements.spaceCloseConfirm.addEventListener("click", () => {
    void ctx.services.confirmSpaceClose();
  });
  ctx.elements.treeContextRename.addEventListener("click", () => {
    const target = ctx.state.treeContextTarget;
    const row = ctx.state.treeContextInvoker;
    if (!target || !row) return;
    ctx.services.closeTreeContextMenu();
    ctx.services.openRename(row, {
      ...target,
      commandId: target.action,
      invocation: { source: "ui", bindingLabel: null },
    });
  });
  ctx.elements.treeContextClose.addEventListener("click", () => {
    void ctx.services.activateTreeContextClose();
  });
  ctx.elements.treeContextMenu.addEventListener("keydown", (event) => {
    const items = [
      ctx.elements.treeContextRename,
      ctx.elements.treeContextClose,
    ].filter((item) => !item.disabled);
    const index = items.indexOf(
      ctx.runtime.document.activeElement as HTMLButtonElement,
    );
    if (event.key === "Escape") {
      event.preventDefault();
      ctx.services.closeTreeContextMenu({ restoreFocus: true });
      return;
    }
    if (event.key === "Tab") {
      ctx.runtime.setTimeout(() => ctx.services.closeTreeContextMenu(), 0);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      items[
        (Math.max(0, index) + delta + items.length) % items.length
      ]?.focus();
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && index >= 0) {
      event.preventDefault();
      items[index]?.click();
    }
  });
  ctx.runtime.document.addEventListener("pointerdown", (event) => {
    const target = event.target as Node | null;
    if (
      !ctx.desktopMedia.matches &&
      !ctx.elements.agentMenu.hidden &&
      !ctx.elements.agentMenu.contains(target) &&
      !ctx.elements.agentMenuToggle.contains(target)
    )
      ctx.services.closeAgentMenu();
    if (
      (ctx.desktopMedia.matches || ctx.state.treeOpen) &&
      !ctx.elements.settingsPopover.hidden &&
      !ctx.elements.settingsPopover.contains(target) &&
      !ctx.elements.settingsToggle.contains(target)
    )
      ctx.services.closeSettings();
    if (
      ctx.desktopMedia.matches &&
      !ctx.elements.treeContextMenu.hidden &&
      !ctx.elements.treeContextMenu.contains(target)
    )
      ctx.services.closeTreeContextMenu();
  });
  ctx.runtime.document.addEventListener("keydown", (event) => {
    if (!ctx.elements.spaceCloseDialog.hidden) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        ctx.services.cancelSpaceClose({ restoreFocus: true });
        return;
      }
      if (
        event.key === "Enter" &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        event.stopPropagation();
        void ctx.services.confirmSpaceClose();
        return;
      }
      if (ctx.services.trapDialogFocus(event, ctx.elements.spaceCloseDialog))
        event.stopPropagation();
      return;
    }
    if (!ctx.elements.commandDialog.hidden) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        ctx.services.closeCommandDialog({ restoreFocus: true });
        return;
      }
      if (
        ctx.state.commandDialogState?.mode === "palette" &&
        (event.key === "ArrowDown" ||
          event.key === "ArrowUp" ||
          event.key === "Home" ||
          event.key === "End")
      ) {
        event.preventDefault();
        event.stopPropagation();
        ctx.services.movePaletteSelection(event.key);
        return;
      }
      if (
        ctx.state.commandDialogState?.mode === "palette" &&
        event.key === "Enter"
      ) {
        event.preventDefault();
        event.stopPropagation();
        const command =
          ctx.state.commandDialogState.commands[
            ctx.state.commandDialogState.selectedIndex
          ];
        if (command) ctx.services.activatePaletteCommand(command.id);
        return;
      }
      if (ctx.services.trapDialogFocus(event, ctx.elements.commandDialog)) {
        event.stopPropagation();
        return;
      }
      return;
    }
    const shortcut = ctx.services.recognizeShortcut(event);
    if (shortcut.kind === "prefix") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (shortcut.kind === "command" && shortcut.command) {
      event.preventDefault();
      event.stopPropagation();
      ctx.services.dispatchCommand(shortcut.command.id, {
        source: "shortcut",
        bindingLabel: shortcut.bindingLabel,
      });
      return;
    }
    if (event.key !== "Escape") return;
    if (!ctx.elements.settingsPopover.hidden) {
      ctx.services.closeSettings({ restoreFocus: true });
      return;
    }
    if (ctx.desktopMedia.matches && !ctx.elements.treeContextMenu.hidden) {
      ctx.services.closeTreeContextMenu({ restoreFocus: true });
      return;
    }
    if (ctx.desktopMedia.matches) return;
    if (ctx.state.treeOpen) {
      ctx.services.closeTreeMenu({ restoreFocus: true });
      return;
    }
    if (!ctx.elements.agentMenu.hidden) {
      ctx.services.closeAgentMenu();
      ctx.elements.agentMenuToggle.focus();
    }
  });
  ctx.runtime.window.addEventListener("message", (event) => {
    if (ctx.services.handleShortcutMessage(event)) return;
    if (ctx.services.handleActionMessage(event)) return;
    const entry = [...ctx.state.frameRegistry.values()].find(
      (candidate) => event.source === candidate.frame.contentWindow,
    );
    if (!entry || event.origin !== entry.origin) return;
    const data = event.data;
    if (
      !data ||
      typeof data !== "object" ||
      data.type !== constants.ROUTE_MESSAGE ||
      data.version !== 1
    )
      return;
    if (
      Object.keys(data).some(
        (key) =>
          ![
            "type",
            "version",
            "view",
            "spaceId",
            "tabId",
            "paneId",
            "session",
          ].includes(key),
      )
    )
      return;
    const hasSession = Object.prototype.hasOwnProperty.call(data, "session");
    const session = hasSession ? ctx.services.validSession(data.session) : null;
    if (hasSession && !session) return;
    let route;
    if (data.view === "home") {
      if (
        Object.prototype.hasOwnProperty.call(data, "spaceId") ||
        Object.prototype.hasOwnProperty.call(data, "tabId") ||
        Object.prototype.hasOwnProperty.call(data, "paneId")
      )
        return;
      route = { view: "home", ...(session ? { session } : {}) };
    } else if (data.view === "pane") {
      const paneId = ctx.services.validPane(data.paneId);
      if (!paneId) return;
      const hasSpace = Object.prototype.hasOwnProperty.call(data, "spaceId");
      const hasTab = Object.prototype.hasOwnProperty.call(data, "tabId");
      if (hasSpace !== hasTab) return;
      const spaceId = hasSpace ? ctx.services.validPane(data.spaceId) : null;
      const tabId = hasTab ? ctx.services.validPane(data.tabId) : null;
      if ((hasSpace && !spaceId) || (hasTab && !tabId)) return;
      route = ctx.services.canonicalPaneRoute(
        paneId,
        session,
        spaceId,
        tabId,
        entry.id,
      );
    } else return;
    ctx.services.cancelDialogsForRoute(entry.id, route);
    entry.route = route;
    entry.frameKey = ctx.services.routeKey(entry.origin, route);
    ctx.services.recordPaneFocus(entry.id, route);
    if (entry.id !== ctx.state.selectedId) return;
    ctx.services.replaceUrl(entry.id, route);
    ctx.services.syncCurrentAgentControl();
    ctx.elements.openNode.href = ctx.services.frameHref(entry.origin, route);
    ctx.services.renderTree();
  });
  ctx.elements.retryFrame.addEventListener("click", () =>
    ctx.services.loadSelected(true),
  );
  ctx.elements.retryInventory.addEventListener("click", () =>
    ctx.services.refresh({ manual: true }),
  );
  ctx.runtime.window.addEventListener("popstate", () => {
    const id = ctx.services.requested();
    if (ctx.state.nodes.some((node) => node.id === id))
      ctx.services.selectNode(id, { routeFromUrl: true });
  });
  ctx.services.bindRailResizer(ctx.elements.hostRailResizer, "left");
  ctx.services.bindRailResizer(ctx.elements.agentRailResizer, "right");
  ctx.runtime.window.addEventListener(
    "resize",
    ctx.services.applyRailWidthPreferences,
  );
  ctx.runtime.window.addEventListener("resize", () =>
    ctx.services.closeTreeContextMenu(),
  );
  ctx.runtime.window.addEventListener(
    "blur",
    ctx.services.cancelShortcutPrefix,
  );
  ctx.runtime.window.addEventListener("storage", (event) => {
    if (event.key === constants.AGENT_FAVORITES_STORAGE_KEY) {
      ctx.state.agentFavorites = ctx.services.readAgentFavorites();
      ctx.services.renderAgents();
    }
  });
  ctx.runtime.document.addEventListener("visibilitychange", () => {
    ctx.services.cancelShortcutPrefix();
    ctx.services.broadcastFrameActivity();
  });
  ctx.desktopMedia.addEventListener("change", ctx.services.syncAgentMenuLayout);
  ctx.terminalDesktopMedia.addEventListener(
    "change",
    ctx.services.syncTerminalEntry,
  );
  ctx.services.syncAgentMenuLayout();
  void ctx.services.refresh();
  return ctx;
}
