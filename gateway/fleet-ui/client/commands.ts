import * as constants from "./constants.ts";
import type { FleetClientContext } from "./context.ts";

export function installCommands(ctx: FleetClientContext): void {
  ctx.services.currentTreeContext = function () {
    const entry = ctx.services.activeEntry();
    const route = entry?.route;
    const node = ctx.services.selectedNode();
    if (
      !entry ||
      !node ||
      route?.view !== "pane" ||
      !route.spaceId ||
      !route.tabId ||
      !route.paneId
    )
      return null;
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
    if (!tree) return null;
    const space = (Array.isArray(tree.spaces) ? tree.spaces : []).find(
      (candidate: any) => candidate?.workspaceId === route.spaceId,
    );
    if (!space) return null;
    const tab = (Array.isArray(space.tabs) ? space.tabs : []).find(
      (candidate: any) => candidate?.tabId === route.tabId,
    );
    if (!tab) return null;
    const pane = (Array.isArray(tab.panes) ? tab.panes : []).find(
      (candidate: any) => candidate?.paneId === route.paneId,
    );
    if (!pane) return null;
    return {
      entry,
      node,
      route,
      tree,
      space,
      tab,
      pane,
      session,
      reachable: tree.reachable === true && node.health === "online",
    };
  };

  ctx.services.dialogTargetKey = (target) =>
    [target.nodeId, target.session || "", target.kind, target.targetId].join(
      "|",
    );
  ctx.services.routeTargetKey = (nodeId, route, kind) => {
    if (!nodeId || route?.view !== "pane") return null;
    const id =
      kind === "space"
        ? route.spaceId
        : kind === "tab"
          ? route.tabId
          : route.paneId;
    return id ? [nodeId, route.session || "", kind, id].join("|") : null;
  };
  ctx.services.currentRouteTargetKey = (kind) =>
    ctx.services.routeTargetKey(
      ctx.state.selectedId,
      ctx.services.activeEntry()?.route,
      kind,
    );
  ctx.services.commandBindingLabel = (binding) =>
    binding.kind === "prefix"
      ? ctx.shortcutPrefix.label + " " + binding.label
      : binding.label;
  ctx.services.commandBindingLabels = (command) =>
    command.bindings.map(ctx.services.commandBindingLabel);
  ctx.services.commandHasBinding = (commandId) =>
    Boolean(ctx.commandsById.get(commandId)?.bindings.length);

  ctx.services.selectedPaneCommandAvailable = function (action) {
    const context = ctx.services.currentTreeContext();
    if (
      !context ||
      !context.entry.loaded ||
      context.entry.frame.hidden ||
      !context.reachable
    )
      return false;
    return (
      (context.entry.shortcutProtocol === constants.SHORTCUT_VERSION &&
        context.entry.shortcutActions.has(action)) ||
      (action === "fit-pane-width" &&
        context.entry.shortcutProtocol === constants.LEGACY_SHORTCUT_VERSION)
    );
  };

  ctx.services.commandAvailable = function (commandId) {
    if (!ctx.desktopMedia.matches || ctx.runtime.document.hidden) return false;
    if (
      commandId === "open-fleet-settings" ||
      commandId === "open-command-palette" ||
      commandId === "toggle-fleet-sidebars"
    )
      return true;
    if (commandId === "previous-pane" || commandId === "next-pane")
      return Boolean(
        ctx.services.currentTreeContext() &&
          ctx.state.paneShortcutTargets.length,
      );
    if (commandId === "previous-agent" || commandId === "next-agent")
      return ctx.state.agentShortcutTargets.length > 0;
    const agentOrdinal = /^select-agent-([1-9])$/.exec(commandId);
    if (agentOrdinal)
      return Boolean(
        ctx.state.agentShortcutTargets[Number(agentOrdinal[1]) - 1],
      );
    const tabOrdinal = /^select-tab-([1-9])$/.exec(commandId);
    if (tabOrdinal) {
      const context = ctx.services.currentTreeContext();
      return Boolean(
        context &&
          Array.isArray(context.space.tabs) &&
          context.space.tabs[Number(tabOrdinal[1]) - 1],
      );
    }
    if (
      commandId === "next-tab" ||
      commandId === "previous-tab" ||
      commandId === "next-pane-in-tab" ||
      commandId === "previous-pane-in-tab" ||
      commandId === "create-tab" ||
      commandId === "rename-space" ||
      commandId === "close-space" ||
      commandId === "rename-tab" ||
      commandId === "close-tab" ||
      commandId === "rename-pane" ||
      commandId === "close-pane" ||
      commandId === "copy-fleet-pane-link"
    )
      return Boolean(ctx.services.currentTreeContext()?.reachable);
    if (commandId === "last-pane") {
      ctx.services.prunePaneMru();
      return ctx.state.paneMru.length >= 2;
    }
    return (
      constants.CHILD_SHORTCUT_ACTIONS.has(commandId) &&
      ctx.services.selectedPaneCommandAvailable(commandId)
    );
  };

  ctx.services.closeCommandDialog = function ({ restoreFocus = false } = {}) {
    const state = ctx.state.commandDialogState;
    ctx.state.commandDialogState = null;
    ctx.elements.commandDialog.hidden = true;
    ctx.elements.commandDialogError.hidden = true;
    ctx.elements.commandDialogError.textContent = "";
    ctx.elements.commandDialogResults.replaceChildren();
    ctx.elements.commandDialogSave.disabled = false;
    ctx.elements.commandDialogCancel.disabled = false;
    if (restoreFocus && state?.invoker?.isConnected) state.invoker.focus();
  };

  ctx.services.cancelDialogsForRoute = function (nodeId, route) {
    if (
      ctx.state.commandDialogState?.mode === "rename" &&
      ctx.state.commandDialogState.target.enforceRoute &&
      ctx.services.routeTargetKey(
        nodeId,
        route,
        ctx.state.commandDialogState.target.kind,
      ) !== ctx.state.commandDialogState.target.key
    )
      ctx.services.closeCommandDialog();
    if (
      ctx.state.spaceCloseState &&
      ctx.services.routeTargetKey(nodeId, route, "space") !==
        ctx.state.spaceCloseState.key
    )
      ctx.services.cancelSpaceClose();
  };

  ctx.services.paletteMatches = function (command, query) {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const haystack = [
      command.id,
      command.name,
      ...ctx.services.commandBindingLabels(command),
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((term: string) => haystack.includes(term));
  };

  ctx.services.paletteResultButton = function (command, selected) {
    const button = ctx.services.element("button", "command-dialog-result");
    button.type = "button";
    button.id = "command-option-" + command.id;
    button.dataset.commandId = command.id;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(selected));
    button.disabled = !ctx.services.commandAvailable(command.id);
    const copy = ctx.services.element("span", "command-result-copy");
    copy.append(
      ctx.services.element("span", "command-result-name", command.name),
      ctx.services.element("span", "command-result-id", command.id),
    );
    const bindings = ctx.services.element("span", "command-result-bindings");
    const labels = ctx.services.commandBindingLabels(command);
    if (labels.length) {
      for (const label of labels)
        bindings.append(ctx.services.element("kbd", "", label));
    } else
      bindings.append(
        ctx.services.element("span", "command-result-unbound", "Unbound"),
      );
    button.append(copy, bindings);
    button.addEventListener("click", () =>
      ctx.services.activatePaletteCommand(command.id),
    );
    return button;
  };

  ctx.services.renderCommandPalette = function () {
    const state = ctx.state.commandDialogState;
    if (state?.mode !== "palette") return;
    ctx.elements.commandDialogResults.replaceChildren();
    ctx.elements.commandDialogError.hidden = true;
    ctx.elements.commandDialogError.textContent = "";
    const value = ctx.elements.commandDialogInput.value;
    if (value && value[0] !== "/") {
      ctx.elements.commandDialogHint.textContent =
        "This input mode is reserved for a future Fleet feature.";
      state.commands = [];
      state.selectedIndex = -1;
      return;
    }
    ctx.elements.commandDialogHint.textContent = value
      ? "Search command id, English name, or effective binding."
      : "Type / to search commands.";
    const query = value.startsWith("/") ? value.slice(1) : "";
    state.commands = ctx.commandCatalog.filter((command) =>
      ctx.services.paletteMatches(command, query),
    );
    const enabled = state.commands
      .map((command: any, index: number) =>
        ctx.services.commandAvailable(command.id) ? index : -1,
      )
      .filter((index: number) => index >= 0);
    if (!enabled.includes(state.selectedIndex))
      state.selectedIndex = enabled[0] ?? -1;
    if (!state.commands.length) {
      ctx.elements.commandDialogResults.append(
        ctx.services.element(
          "p",
          "command-dialog-hint",
          "No matching Fleet commands.",
        ),
      );
      return;
    }
    state.commands.forEach((command: any, index: number) =>
      ctx.elements.commandDialogResults.append(
        ctx.services.paletteResultButton(
          command,
          index === state.selectedIndex,
        ),
      ),
    );
    const active = ctx.elements.commandDialogResults.querySelector(
      '[aria-selected="true"]',
    );
    if (active)
      ctx.elements.commandDialogInput.setAttribute(
        "aria-activedescendant",
        active.id,
      );
    else
      ctx.elements.commandDialogInput.removeAttribute("aria-activedescendant");
  };

  ctx.services.openCommandPalette = function (
    invoker = ctx.runtime.document.activeElement,
  ) {
    ctx.services.closeTreeContextMenu();
    ctx.services.closeSettings();
    ctx.services.closeCommandDialog();
    ctx.services.cancelSpaceClose();
    ctx.state.commandDialogState = {
      mode: "palette",
      invoker,
      commands: [],
      selectedIndex: -1,
    };
    ctx.elements.commandDialogTitle.textContent = "Command Palette";
    ctx.elements.commandDialogInput.value = "";
    ctx.elements.commandDialogHint.hidden = false;
    ctx.elements.commandDialogResults.hidden = false;
    ctx.elements.commandDialogActions.hidden = true;
    ctx.elements.commandDialog.hidden = false;
    ctx.services.renderCommandPalette();
    ctx.runtime.requestAnimationFrame(() =>
      ctx.elements.commandDialogInput.focus(),
    );
    return true;
  };

  ctx.services.activatePaletteCommand = function (commandId) {
    const state = ctx.state.commandDialogState;
    if (state?.mode !== "palette" || !ctx.services.commandAvailable(commandId))
      return;
    ctx.services.closeCommandDialog();
    ctx.services.dispatchCommand(commandId, { source: "palette" });
  };
}
