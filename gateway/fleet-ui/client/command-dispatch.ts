import type { FleetClientContext } from "./context.ts";

export function installCommandDispatch(ctx: FleetClientContext): void {
  ctx.services.currentRenameTarget = function (commandId, invocation) {
    const context = ctx.services.currentTreeContext();
    if (!context?.reachable) return null;
    const shared = {
      nodeId: context.node.id,
      session: context.session,
      reachable: true,
      enforceRoute: true,
      commandId,
      invocation,
    };
    if (commandId === "rename-space")
      return {
        ...shared,
        kind: "space",
        action: "rename-workspace",
        targetId: context.route.spaceId,
        label: context.space.label || "Space " + context.space.number,
      };
    if (commandId === "rename-tab")
      return {
        ...shared,
        kind: "tab",
        action: "rename-tab",
        targetId: context.route.tabId,
        label: context.tab.label || "Tab " + context.tab.number,
      };
    return {
      ...shared,
      kind: "pane",
      action: "rename-pane",
      targetId: context.route.paneId,
      tabId: context.route.tabId,
      label: context.pane.label || "",
    };
  };

  ctx.services.currentTreeRow = function (context, kind) {
    const key = ctx.services.treeKey(
      context.node.id,
      context.session,
      kind,
      kind === "tab" ? context.route.tabId : context.route.paneId,
    );
    return (
      Array.from(
        ctx.elements.instances.querySelectorAll<HTMLElement>("[data-tree-key]"),
      ).find((row) => row.dataset.treeKey === key) ||
      ctx.elements.instances.querySelector<HTMLElement>(
        '[aria-selected="true"][data-tree-key]',
      )
    );
  };

  ctx.services.openCurrentTreeClose = function (kind) {
    const context = ctx.services.currentTreeContext();
    if (!context?.reachable) return false;
    const row = ctx.services.currentTreeRow(context, kind);
    if (!row) return false;
    const panes = ctx.services
      .validTabPanes(context.tab)
      .map(({ paneId }: any) => paneId);
    const target =
      kind === "tab"
        ? {
            nodeId: context.node.id,
            kind: "tab",
            action: "rename-tab",
            targetId: context.route.tabId,
            label: context.tab.label || "Tab " + context.tab.number,
            paneIds: panes,
            paneCount: panes.length,
            session: context.session,
            reachable: true,
            fromCommand: true,
          }
        : {
            nodeId: context.node.id,
            kind: "pane",
            action: "rename-pane",
            targetId: context.route.paneId,
            tabId: context.route.tabId,
            label: context.pane.label || "",
            session: context.session,
            reachable: true,
            fromCommand: true,
          };
    ctx.services.openTreeContextMenu(row, target, null);
    ctx.runtime.requestAnimationFrame(() => {
      if (ctx.state.treeContextTarget?.targetId !== target.targetId) return;
      void ctx.services.activateTreeContextClose();
      ctx.elements.treeContextClose.focus();
    });
    return true;
  };

  ctx.services.createCurrentTab = async function () {
    const context = ctx.services.currentTreeContext();
    if (!context?.reachable) return false;
    try {
      const result = await ctx.services.dispatchNodeAction(context.node, {
        action: "create-tab",
        workspaceId: context.route.spaceId,
        ...(context.session ? { session: context.session } : {}),
      });
      if (!result.ok) {
        ctx.services.showTreeActionStatus(result.error, "error");
        return false;
      }
      const pane = result.pane;
      ctx.services.selectCanonicalPaneTarget(context.node.id, {
        view: "pane",
        spaceId: pane.workspaceId,
        tabId: pane.tabId,
        paneId: pane.paneId,
        ...(context.session ? { session: context.session } : {}),
      });
      void ctx.services.refresh({ manual: true });
      return true;
    } catch (error) {
      ctx.services.showTreeActionStatus(
        error instanceof Error ? error.message : String(error),
        "error",
      );
      return false;
    }
  };

  ctx.services.copyCurrentPaneLink = async function () {
    const context = ctx.services.currentTreeContext();
    if (!context || !ctx.runtime.clipboard?.writeText) return false;
    const url = new URL("/", ctx.runtime.location.origin);
    url.searchParams.set("instance", context.node.id);
    url.searchParams.set("space", context.route.spaceId);
    url.searchParams.set("tab", context.route.tabId);
    url.searchParams.set("pane", context.route.paneId);
    if (context.session) url.searchParams.set("session", context.session);
    try {
      await ctx.runtime.clipboard.writeText(url.href);
      return true;
    } catch (error) {
      ctx.services.showTreeActionStatus(
        error instanceof Error
          ? error.message
          : "Could not copy the Fleet Pane link.",
        "error",
      );
      return false;
    }
  };

  ctx.services.setSidebarsCollapsed = function (collapsed) {
    if (collapsed && !ctx.desktopMedia.matches) return false;
    ctx.state.sidebarsCollapsed = Boolean(collapsed);
    ctx.elements.shell.dataset.sidebarsCollapsed = String(
      ctx.state.sidebarsCollapsed,
    );
    ctx.elements.hostRail.inert = ctx.state.sidebarsCollapsed;
    ctx.elements.hostRail.setAttribute(
      "aria-hidden",
      String(ctx.state.sidebarsCollapsed),
    );
    ctx.elements.agentMenu.inert = ctx.state.sidebarsCollapsed;
    ctx.elements.agentMenu.setAttribute(
      "aria-hidden",
      String(ctx.state.sidebarsCollapsed),
    );
    for (const handle of [
      ctx.elements.hostRailResizer,
      ctx.elements.agentRailResizer,
    ]) {
      handle.inert = ctx.state.sidebarsCollapsed;
      handle.tabIndex = ctx.state.sidebarsCollapsed ? -1 : 0;
      handle.setAttribute("aria-hidden", String(ctx.state.sidebarsCollapsed));
    }
    return true;
  };

  ctx.services.acknowledgeCommand = function (command, source, bindingLabel) {
    ctx.services.showCommandToast(
      command,
      source === "shortcut" ? bindingLabel : null,
    );
  };

  ctx.services.dispatchCommand = function (
    commandId,
    { source = "ui", bindingLabel = null, childOriginated = false } = {},
  ) {
    const command = ctx.commandsById.get(commandId);
    if (!command || !ctx.desktopMedia.matches || ctx.runtime.document.hidden)
      return false;
    if (
      source === "shortcut" &&
      !command.bindings.some(
        (binding) => bindingLabel === ctx.services.commandBindingLabel(binding),
      )
    )
      return false;
    if (!ctx.services.commandAvailable(commandId)) {
      ctx.services.showTreeActionStatus(
        command.name + " is unavailable.",
        "error",
      );
      return false;
    }
    let accepted = false;
    if (commandId === "open-fleet-settings")
      accepted = ctx.services.openSettings();
    else if (commandId === "open-command-palette")
      accepted = ctx.services.openCommandPalette();
    else if (commandId === "toggle-fleet-sidebars")
      accepted = ctx.services.setSidebarsCollapsed(
        !ctx.state.sidebarsCollapsed,
      );
    else if (commandId === "previous-pane")
      accepted = ctx.services.cyclePaneShortcut(-1, childOriginated);
    else if (commandId === "next-pane")
      accepted = ctx.services.cyclePaneShortcut(1, childOriginated);
    else if (commandId === "previous-agent")
      accepted = ctx.services.cycleAgentShortcut(-1, childOriginated);
    else if (commandId === "next-agent")
      accepted = ctx.services.cycleAgentShortcut(1, childOriginated);
    else if (
      commandId === "next-tab" ||
      commandId === "previous-tab" ||
      /^select-tab-[1-9]$/.test(commandId)
    )
      accepted = ctx.services.navigateTab(commandId, childOriginated);
    else if (
      commandId === "next-pane-in-tab" ||
      commandId === "previous-pane-in-tab"
    )
      accepted = ctx.services.navigatePaneInTab(
        commandId === "next-pane-in-tab" ? 1 : -1,
        childOriginated,
      );
    else if (commandId === "last-pane")
      accepted = ctx.services.navigateLastPane(childOriginated);
    else if (
      commandId === "rename-space" ||
      commandId === "rename-tab" ||
      commandId === "rename-pane"
    ) {
      const target = ctx.services.currentRenameTarget(commandId, {
        source,
        bindingLabel,
      });
      accepted = Boolean(
        target &&
          ctx.services.openRename(ctx.runtime.document.activeElement, target),
      );
    } else if (commandId === "close-space")
      accepted = ctx.services.openSpaceClose(ctx.services.currentTreeContext());
    else if (commandId === "close-tab")
      accepted = ctx.services.openCurrentTreeClose("tab");
    else if (commandId === "close-pane")
      accepted = ctx.services.openCurrentTreeClose("pane");
    else if (commandId === "create-tab") {
      void ctx.services.createCurrentTab().then((ok: boolean) => {
        if (ok) ctx.services.acknowledgeCommand(command, source, bindingLabel);
      });
      return true;
    } else if (commandId === "copy-fleet-pane-link") {
      void ctx.services.copyCurrentPaneLink().then((ok: boolean) => {
        if (ok) ctx.services.acknowledgeCommand(command, source, bindingLabel);
      });
      return true;
    } else {
      const childActions = new Set([
        "fit-pane-width",
        "toggle-type-mode",
        "send-escape",
        "send-enter",
        "send-up-arrow",
        "send-down-arrow",
        "send-left-arrow",
        "send-right-arrow",
        "send-space",
        "send-ctrl-c",
      ]);
      if (childActions.has(commandId)) {
        void ctx.services
          .dispatchSelectedShortcutAction(commandId)
          .then((ok: boolean) => {
            if (ok)
              ctx.services.acknowledgeCommand(command, source, bindingLabel);
          });
        return true;
      }
    }
    if (
      accepted &&
      commandId !== "rename-space" &&
      commandId !== "rename-tab" &&
      commandId !== "rename-pane"
    )
      ctx.services.acknowledgeCommand(command, source, bindingLabel);
    return accepted;
  };
}
