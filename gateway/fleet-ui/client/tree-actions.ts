import * as constants from "./constants.ts";
import type { FleetClientContext } from "./context.ts";

export function installTreeActions(ctx: FleetClientContext): void {
  ctx.services.openRename = function (row, target) {
    if (!ctx.desktopMedia.matches || target.reachable !== true) return false;
    ctx.services.closeTreeContextMenu();
    ctx.services.closeSettings();
    ctx.services.closeCommandDialog();
    ctx.services.cancelSpaceClose();
    const kind =
      target.action === "rename-workspace"
        ? "Space"
        : target.action === "rename-tab"
          ? "Tab"
          : "Pane";
    ctx.state.commandDialogState = {
      mode: "rename",
      target: { ...target, row, key: ctx.services.dialogTargetKey(target) },
      invoker: row,
    };
    ctx.elements.commandDialogTitle.textContent = "Rename " + kind;
    ctx.elements.commandDialogInput.value = target.label || "";
    ctx.elements.commandDialogHint.textContent =
      kind === "Pane"
        ? "Submit an empty value to clear the Pane label."
        : "Enter a non-empty " + kind + " name.";
    ctx.elements.commandDialogHint.hidden = false;
    ctx.elements.commandDialogResults.hidden = true;
    ctx.elements.commandDialogActions.hidden = false;
    ctx.elements.commandDialogError.hidden = true;
    ctx.elements.commandDialogError.textContent = "";
    ctx.elements.commandDialog.hidden = false;
    requestAnimationFrame(() => {
      ctx.elements.commandDialogInput.focus();
      ctx.elements.commandDialogInput.select();
    });
    return true;
  };

  ctx.services.contextCloseLabel = function (target, armed = false) {
    const kind = target?.kind === "tab" ? "Tab" : "Pane";
    if (!armed) return "Close " + kind;
    const count =
      target?.kind === "tab" && Number.isSafeInteger(target.paneCount)
        ? " · " +
          target.paneCount +
          " " +
          (target.paneCount === 1 ? "Pane" : "Panes")
        : "";
    return "Confirm Close " + kind + count;
  };

  ctx.services.disarmTreeContextClose = function () {
    if (ctx.state.treeContextArmedTimer !== null) {
      ctx.runtime.clearTimeout(ctx.state.treeContextArmedTimer);
      ctx.state.treeContextArmedTimer = null;
    }
    ctx.elements.treeContextClose.dataset.armed = "false";
    ctx.elements.treeContextClose.textContent = ctx.services.contextCloseLabel(
      ctx.state.treeContextTarget,
      false,
    );
  };

  ctx.services.closeTreeContextMenu = function ({ restoreFocus = false } = {}) {
    const invoker = ctx.state.treeContextInvoker;
    ctx.services.disarmTreeContextClose();
    ctx.state.treeContextTarget = null;
    ctx.state.treeContextInvoker = null;
    ctx.elements.treeContextMenu.hidden = true;
    delete ctx.elements.treeContextMenu.dataset.pending;
    ctx.elements.treeContextRename.disabled = false;
    ctx.elements.treeContextClose.disabled = false;
    ctx.elements.treeContextError.hidden = true;
    ctx.elements.treeContextError.textContent = "";
    if (restoreFocus && invoker?.isConnected) invoker.focus();
  };

  ctx.services.placeTreeContextMenu = function (left, top) {
    const gap = 8;
    const bounds = ctx.elements.treeContextMenu.getBoundingClientRect();
    ctx.elements.treeContextMenu.style.left =
      Math.round(
        Math.max(
          gap,
          Math.min(left, ctx.runtime.viewportWidth() - bounds.width - gap),
        ),
      ) + "px";
    ctx.elements.treeContextMenu.style.top =
      Math.round(
        Math.max(gap, Math.min(top, innerHeight - bounds.height - gap)),
      ) + "px";
  };

  ctx.services.openTreeContextMenu = function (row, target, anchor) {
    if (
      !ctx.desktopMedia.matches ||
      target.reachable !== true ||
      !row.isConnected
    )
      return;
    ctx.services.closeCommandDialog();
    ctx.services.cancelSpaceClose();
    ctx.services.closeSettings();
    ctx.services.closeTreeContextMenu();
    ctx.state.treeContextTarget = { ...target, row };
    ctx.state.treeContextInvoker = row;
    ctx.elements.treeContextClose.textContent = ctx.services.contextCloseLabel(
      target,
      false,
    );
    ctx.elements.treeContextClose.dataset.armed = "false";
    ctx.elements.treeContextMenu.hidden = false;
    const bounds = row.getBoundingClientRect();
    const left = anchor?.x ?? bounds.left + 18;
    const top = anchor?.y ?? bounds.bottom + 4;
    ctx.runtime.requestAnimationFrame(() => {
      if (ctx.state.treeContextTarget?.row !== row) return;
      ctx.services.placeTreeContextMenu(left, top);
      ctx.elements.treeContextRename.focus();
    });
  };

  ctx.services.bindTreeContextActions = function (row, target) {
    row.setAttribute("aria-haspopup", "menu");
    row.addEventListener("contextmenu", (event: MouseEvent) => {
      if (!ctx.desktopMedia.matches) return;
      event.preventDefault();
      ctx.services.openTreeContextMenu(row, target, {
        x: event.clientX,
        y: event.clientY,
      });
    });
    row.addEventListener("keydown", (event: KeyboardEvent) => {
      if (
        !ctx.desktopMedia.matches ||
        (event.key !== "ContextMenu" &&
          !(event.shiftKey && event.key === "F10"))
      )
        return;
      event.preventDefault();
      ctx.services.openTreeContextMenu(row, target, null);
    });
  };

  ctx.services.contextTargetAffectsCurrent = function (target) {
    const route = ctx.services.activeEntry()?.route;
    if (
      !route ||
      route.view !== "pane" ||
      ctx.state.selectedId !== target.nodeId ||
      (route.session || "") !== (target.session || "")
    )
      return false;
    if (target.kind === "pane") return route.paneId === target.targetId;
    return (
      route.tabId === target.targetId || target.paneIds.includes(route.paneId)
    );
  };

  ctx.services.activateTreeContextClose = async function () {
    const target = ctx.state.treeContextTarget;
    if (!target || ctx.elements.treeContextMenu.dataset.pending === "true")
      return;
    if (ctx.elements.treeContextClose.dataset.armed !== "true") {
      ctx.elements.treeContextClose.dataset.armed = "true";
      ctx.elements.treeContextClose.textContent =
        ctx.services.contextCloseLabel(target, true);
      ctx.state.treeContextArmedTimer = ctx.runtime.setTimeout(() => {
        ctx.state.treeContextArmedTimer = null;
        if (ctx.state.treeContextTarget === target)
          ctx.services.disarmTreeContextClose();
      }, constants.CLOSE_CONFIRM_MS);
      return;
    }
    ctx.services.disarmTreeContextClose();
    const node = ctx.state.nodes.find(
      (candidate) => candidate.id === target.nodeId,
    );
    if (!node || node.health !== "online" || target.reachable !== true) {
      ctx.elements.treeContextError.textContent =
        "This node is currently unavailable.";
      ctx.elements.treeContextError.hidden = false;
      return;
    }
    ctx.elements.treeContextMenu.dataset.pending = "true";
    ctx.elements.treeContextRename.disabled = true;
    ctx.elements.treeContextClose.disabled = true;
    ctx.elements.treeContextClose.textContent =
      "Closing " + (target.kind === "tab" ? "Tab" : "Pane") + "…";
    ctx.elements.treeContextError.hidden = true;
    const affectsCurrent = ctx.services.contextTargetAffectsCurrent(target);
    const payload =
      target.kind === "tab"
        ? { action: "close-tab", tabId: target.targetId }
        : { action: "close-pane", paneId: target.targetId };
    try {
      const result = await ctx.services.dispatchNodeAction(node, {
        ...payload,
        ...(target.session ? { session: target.session } : {}),
      });
      if (!result.ok) {
        ctx.elements.treeContextError.textContent = result.error;
        ctx.elements.treeContextError.hidden = false;
        return;
      }
      ctx.services.closeTreeContextMenu();
      ctx.services.showTreeActionStatus(
        (target.kind === "tab" ? "Tab" : "Pane") + " closed.",
      );
      if (!target.fromCommand) {
        const command = ctx.commandsById.get(
          target.kind === "tab" ? "close-tab" : "close-pane",
        );
        if (command) ctx.services.showCommandToast(command);
      }
      if (affectsCurrent)
        ctx.services.selectNode(node.id, { route: { view: "home" } });
      void ctx.services.refresh({ manual: true });
    } catch (error) {
      ctx.elements.treeContextError.textContent =
        error instanceof Error ? error.message : String(error);
      ctx.elements.treeContextError.hidden = false;
    } finally {
      if (ctx.state.treeContextTarget === target) {
        delete ctx.elements.treeContextMenu.dataset.pending;
        ctx.elements.treeContextRename.disabled = false;
        ctx.elements.treeContextClose.disabled = false;
        ctx.elements.treeContextClose.textContent =
          ctx.services.contextCloseLabel(target, false);
      }
    }
  };

  ctx.services.createPaneFromSpace = async function (node, target, button) {
    if (node.health !== "online" || target.reachable !== true) {
      ctx.services.showTreeActionStatus(
        "This Space is currently unavailable.",
        "error",
      );
      return;
    }
    button.disabled = true;
    ctx.services.showTreeActionStatus("Creating Pane…");
    try {
      const result = await ctx.services.dispatchNodeAction(node, {
        action: "create-tab",
        workspaceId: target.workspaceId,
        ...(target.session ? { session: target.session } : {}),
      });
      if (!result.ok) {
        ctx.services.showTreeActionStatus(result.error, "error");
        return;
      }
      const pane = result.pane;
      ctx.services.showTreeActionStatus("New Pane ready.");
      ctx.services.selectTreeNode(node.id, {
        route: {
          view: "pane",
          spaceId: pane.workspaceId,
          tabId: pane.tabId,
          paneId: pane.paneId,
          ...(target.session ? { session: target.session } : {}),
        },
      });
      void ctx.services.refresh({ manual: true });
    } catch (error) {
      ctx.services.showTreeActionStatus(
        error instanceof Error ? error.message : String(error),
        "error",
      );
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  };

  ctx.services.createSpaceFromHost = async function (node, target, button) {
    if (node.health !== "online" || target.reachable !== true) {
      ctx.services.showTreeActionStatus(
        "This Host is currently unavailable.",
        "error",
      );
      return;
    }
    button.disabled = true;
    ctx.services.showTreeActionStatus("Creating Space…");
    try {
      const result = await ctx.services.dispatchNodeAction(node, {
        action: "create-workspace",
      });
      if (!result.ok) {
        ctx.services.showTreeActionStatus(result.error, "error");
        return;
      }
      const pane = result.pane;
      ctx.services.showTreeActionStatus("New Space ready.");
      ctx.services.selectTreeNode(node.id, {
        route: {
          view: "pane",
          spaceId: pane.workspaceId,
          tabId: pane.tabId,
          paneId: pane.paneId,
        },
      });
      void ctx.services.refresh({ manual: true });
    } catch (error) {
      ctx.services.showTreeActionStatus(
        error instanceof Error ? error.message : String(error),
        "error",
      );
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  };

  ctx.services.submitRename = async function () {
    const state = ctx.state.commandDialogState;
    if (state?.mode !== "rename") return;
    const target = state.target;
    if (
      target.enforceRoute &&
      ctx.services.currentRouteTargetKey(target.kind) !== target.key
    ) {
      ctx.services.closeCommandDialog();
      return;
    }
    const node = ctx.state.nodes.find(
      (candidate) => candidate.id === target.nodeId,
    );
    if (!node || node.health !== "online" || target.reachable !== true) {
      ctx.elements.commandDialogError.textContent =
        "This node is currently unavailable.";
      ctx.elements.commandDialogError.hidden = false;
      return;
    }
    const label = ctx.elements.commandDialogInput.value.trim();
    if (
      (target.action === "rename-workspace" ||
        target.action === "rename-tab") &&
      !label
    ) {
      ctx.elements.commandDialogError.textContent =
        "A " +
        (target.action === "rename-workspace" ? "Space" : "Tab") +
        " name is required.";
      ctx.elements.commandDialogError.hidden = false;
      return;
    }
    ctx.elements.commandDialogError.hidden = true;
    ctx.elements.commandDialogSave.disabled = true;
    ctx.elements.commandDialogCancel.disabled = true;
    const idField =
      target.action === "rename-workspace"
        ? { workspaceId: target.targetId }
        : target.action === "rename-tab"
          ? { tabId: target.targetId }
          : { paneId: target.targetId };
    try {
      const result = await ctx.services.dispatchNodeAction(node, {
        action: target.action,
        ...idField,
        label,
        ...(target.session ? { session: target.session } : {}),
      });
      if (!result.ok) {
        ctx.elements.commandDialogError.textContent = result.error;
        ctx.elements.commandDialogError.hidden = false;
        return;
      }
      const kind =
        target.action === "rename-workspace"
          ? "Space"
          : target.action === "rename-tab"
            ? "Tab"
            : "Pane";
      ctx.services.closeCommandDialog();
      ctx.services.showTreeActionStatus(
        label ? kind + " renamed." : kind + " label cleared.",
      );
      if (target.commandId) {
        const command = ctx.commandsById.get(target.commandId);
        if (command)
          ctx.services.acknowledgeCommand(
            command,
            target.invocation?.source || "ui",
            target.invocation?.bindingLabel || null,
          );
      }
      void ctx.services.refresh({ manual: true });
    } catch (error) {
      ctx.elements.commandDialogError.textContent =
        error instanceof Error ? error.message : String(error);
      ctx.elements.commandDialogError.hidden = false;
    } finally {
      ctx.elements.commandDialogSave.disabled = false;
      ctx.elements.commandDialogCancel.disabled = false;
    }
  };

  ctx.services.cancelSpaceClose = function ({ restoreFocus = false } = {}) {
    const state = ctx.state.spaceCloseState;
    ctx.state.spaceCloseState = null;
    if (ctx.state.spaceCloseTimer !== null) {
      ctx.runtime.clearTimeout(ctx.state.spaceCloseTimer);
      ctx.state.spaceCloseTimer = null;
    }
    ctx.elements.spaceCloseDialog.hidden = true;
    ctx.elements.spaceCloseError.hidden = true;
    ctx.elements.spaceCloseError.textContent = "";
    ctx.elements.spaceCloseConfirm.disabled = false;
    ctx.elements.spaceCloseCancel.disabled = false;
    if (restoreFocus && state?.invoker?.isConnected) state.invoker.focus();
  };

  ctx.services.openSpaceClose = function (
    context,
    invoker = ctx.runtime.document.activeElement,
  ) {
    if (!context?.reachable) return false;
    ctx.services.closeCommandDialog();
    ctx.services.closeTreeContextMenu();
    ctx.services.closeSettings();
    ctx.services.cancelSpaceClose();
    const label = context.space.label || "Space " + context.space.number;
    const paneCount = (
      Array.isArray(context.space.tabs) ? context.space.tabs : []
    ).reduce(
      (count: number, tab: any) =>
        count + (Array.isArray(tab?.panes) ? tab.panes.length : 0),
      0,
    );
    ctx.state.spaceCloseState = {
      nodeId: context.node.id,
      session: context.session,
      targetId: context.route.spaceId,
      key: [
        context.node.id,
        context.session,
        "space",
        context.route.spaceId,
      ].join("|"),
      invoker,
      pending: false,
    };
    ctx.elements.spaceCloseTitle.textContent = "Close " + label + "?";
    ctx.elements.spaceCloseImpact.textContent =
      "Closing this Space may terminate " +
      paneCount +
      " " +
      (paneCount === 1 ? "Pane" : "Panes") +
      ". Press Enter again to confirm.";
    ctx.elements.spaceCloseConfirm.textContent = "Press Enter to confirm";
    ctx.elements.spaceCloseDialog.hidden = false;
    ctx.state.spaceCloseTimer = ctx.runtime.setTimeout(
      () => ctx.services.cancelSpaceClose({ restoreFocus: true }),
      constants.CLOSE_CONFIRM_MS,
    );
    ctx.runtime.requestAnimationFrame(() =>
      ctx.elements.spaceCloseConfirm.focus(),
    );
    return true;
  };

  ctx.services.confirmSpaceClose = async function () {
    const state = ctx.state.spaceCloseState;
    if (!state || state.pending) return;
    if (ctx.services.currentRouteTargetKey("space") !== state.key) {
      ctx.services.cancelSpaceClose();
      return;
    }
    const node = ctx.state.nodes.find(
      (candidate) => candidate.id === state.nodeId,
    );
    if (!node || node.health !== "online") {
      ctx.elements.spaceCloseError.textContent =
        "This node is currently unavailable.";
      ctx.elements.spaceCloseError.hidden = false;
      return;
    }
    state.pending = true;
    if (ctx.state.spaceCloseTimer !== null) {
      ctx.runtime.clearTimeout(ctx.state.spaceCloseTimer);
      ctx.state.spaceCloseTimer = null;
    }
    ctx.elements.spaceCloseConfirm.disabled = true;
    ctx.elements.spaceCloseCancel.disabled = true;
    ctx.elements.spaceCloseConfirm.textContent = "Closing Space…";
    try {
      const result = await ctx.services.dispatchNodeAction(node, {
        action: "close-workspace",
        workspaceId: state.targetId,
        ...(state.session ? { session: state.session } : {}),
      });
      if (!result.ok) {
        ctx.elements.spaceCloseError.textContent = result.error;
        ctx.elements.spaceCloseError.hidden = false;
        state.pending = false;
        ctx.elements.spaceCloseConfirm.disabled = false;
        ctx.elements.spaceCloseCancel.disabled = false;
        ctx.elements.spaceCloseConfirm.textContent = "Press Enter to confirm";
        return;
      }
      ctx.services.cancelSpaceClose();
      ctx.services.showTreeActionStatus("Space closed.");
      ctx.services.selectNode(node.id, { route: { view: "home" } });
      void ctx.services.refresh({ manual: true });
    } catch (error) {
      ctx.elements.spaceCloseError.textContent =
        error instanceof Error ? error.message : String(error);
      ctx.elements.spaceCloseError.hidden = false;
      state.pending = false;
      ctx.elements.spaceCloseConfirm.disabled = false;
      ctx.elements.spaceCloseCancel.disabled = false;
      ctx.elements.spaceCloseConfirm.textContent = "Press Enter to confirm";
    }
  };
}
