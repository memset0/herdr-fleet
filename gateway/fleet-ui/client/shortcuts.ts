import * as constants from "./constants.ts";
import type { FleetClientContext } from "./context.ts";

export function installShortcuts(ctx: FleetClientContext): void {
  ctx.services.cancelShortcutPrefix = function () {
    ctx.shortcutRecognizer.cancel();
    ctx.state.shortcutPendingAt = null;
    if (ctx.state.shortcutPrefixTimer !== null) {
      ctx.runtime.clearTimeout(ctx.state.shortcutPrefixTimer);
      ctx.state.shortcutPrefixTimer = null;
    }
  };

  ctx.services.recognizeShortcut = function (event) {
    if (!ctx.desktopMedia.matches || ctx.runtime.document.hidden) {
      return { kind: "ignored" };
    }
    const recognition = ctx.shortcutRecognizer.handle(event);
    if (recognition.kind === "prefix") {
      ctx.state.shortcutPendingAt = ctx.runtime.now();
      ctx.state.shortcutPrefixTimer = ctx.runtime.setTimeout(
        ctx.services.cancelShortcutPrefix,
        constants.SHORTCUT_PREFIX_TIMEOUT_MS,
      );
      return recognition;
    }
    ctx.state.shortcutPendingAt = null;
    if (ctx.state.shortcutPrefixTimer !== null) {
      ctx.runtime.clearTimeout(ctx.state.shortcutPrefixTimer);
      ctx.state.shortcutPrefixTimer = null;
    }
    return recognition.kind === "command"
      ? {
          kind: "command",
          command: ctx.commandsById.get(recognition.commandId),
          bindingLabel: recognition.bindingLabel,
        }
      : recognition;
  };

  ctx.services.actionRequestId = function () {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return (
      ctx.runtime.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 18)
    );
  };

  ctx.services.validCorrelationId = function (value) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value);
  };

  ctx.services.finishPendingShortcutCommand = function (result, error = null) {
    const state = ctx.state.pendingShortcutCommand;
    if (!state) return;
    ctx.runtime.clearTimeout(state.timeout);
    ctx.state.pendingShortcutCommand = null;
    if (error) {
      ctx.services.showTreeActionStatus(error, "error");
      state.resolve(false);
      return;
    }
    if (!result.ok) {
      ctx.services.showTreeActionStatus(result.error, "error");
      state.resolve(false);
      return;
    }
    ctx.services.announce("Selected Pane command completed.");
    state.resolve(true);
  };

  ctx.services.validShortcutResult = function (data, state) {
    if (
      !data ||
      typeof data !== "object" ||
      data.type !== constants.SHORTCUT_RESULT_MESSAGE ||
      data.version !== state.version ||
      data.requestId !== state.requestId ||
      data.action !== state.wireAction ||
      typeof data.ok !== "boolean"
    )
      return false;
    if (
      state.version === constants.SHORTCUT_VERSION &&
      data.generation !== state.generation
    )
      return false;
    const keys =
      state.version === constants.SHORTCUT_VERSION
        ? ["type", "version", "generation", "requestId", "action", "ok"]
        : ["type", "version", "requestId", "action", "ok"];
    return data.ok
      ? ctx.services.exactMessageKeys(data, keys)
      : ctx.services.exactMessageKeys(data, [...keys, "error"]) &&
          typeof data.error === "string" &&
          data.error.length > 0 &&
          data.error.length <= 240;
  };

  ctx.services.dispatchSelectedShortcutAction = function (action) {
    if (!ctx.desktopMedia.matches || ctx.runtime.document.hidden)
      return Promise.resolve(false);
    const entry = ctx.services.activeEntry();
    const route = entry?.route;
    if (
      !entry ||
      entry.frame.hidden ||
      !entry.loaded ||
      route?.view !== "pane"
    ) {
      ctx.services.showTreeActionStatus(
        "The selected Pane command is unavailable.",
        "error",
      );
      return Promise.resolve(false);
    }
    if (ctx.state.pendingShortcutCommand) {
      ctx.services.showTreeActionStatus(
        "Another Pane shortcut is still running.",
        "error",
      );
      return Promise.resolve(false);
    }
    const target = entry.frame.contentWindow;
    if (!target) {
      ctx.services.showTreeActionStatus(
        "Selected Collie page is unavailable.",
        "error",
      );
      return Promise.resolve(false);
    }
    const legacy =
      entry.shortcutProtocol === constants.LEGACY_SHORTCUT_VERSION &&
      action === "fit-pane-width";
    if (
      !legacy &&
      (entry.shortcutProtocol !== constants.SHORTCUT_VERSION ||
        !entry.shortcutActions.has(action))
    ) {
      ctx.services.showTreeActionStatus(
        "This Collie version does not support " + action + ".",
        "error",
      );
      return Promise.resolve(false);
    }
    const requestId = ctx.services.actionRequestId();
    return new Promise((resolve) => {
      const version = legacy
        ? constants.LEGACY_SHORTCUT_VERSION
        : constants.SHORTCUT_VERSION;
      const wireAction = legacy ? "resize-current-pane" : action;
      ctx.state.pendingShortcutCommand = {
        frame: entry.frame,
        origin: entry.origin,
        version,
        generation: entry.shortcutGeneration,
        requestId,
        action,
        wireAction,
        resolve,
        timeout: ctx.runtime.setTimeout(
          () =>
            ctx.services.finishPendingShortcutCommand(
              null,
              "Collie did not confirm the shortcut. Check this node before trying again.",
            ),
          constants.SHORTCUT_COMMAND_TIMEOUT_MS,
        ),
      };
      target.postMessage(
        version === constants.SHORTCUT_VERSION
          ? {
              type: constants.SHORTCUT_COMMAND_MESSAGE,
              version,
              generation: entry.shortcutGeneration,
              requestId,
              action: wireAction,
            }
          : {
              type: constants.SHORTCUT_COMMAND_MESSAGE,
              version,
              requestId,
              action: wireAction,
            },
        entry.origin,
      );
    });
  };

  ctx.services.handleShortcutMessage = function (event) {
    const entry = ctx.services.activeEntry();
    if (
      !entry ||
      event.source !== entry.frame.contentWindow ||
      event.origin !== entry.origin
    )
      return false;
    const data = event.data;
    if (
      data &&
      typeof data === "object" &&
      data.type === constants.SHORTCUT_RESULT_MESSAGE
    ) {
      const state = ctx.state.pendingShortcutCommand;
      if (
        !state ||
        state.frame !== entry.frame ||
        state.origin !== entry.origin
      )
        return true;
      if (ctx.services.validShortcutResult(data, state))
        ctx.services.finishPendingShortcutCommand(data);
      return true;
    }
    if (
      data &&
      typeof data === "object" &&
      data.type === constants.SHORTCUT_READY_MESSAGE
    ) {
      if (
        !ctx.services.exactMessageKeys(data, [
          "type",
          "version",
          "generation",
          "commands",
          "actions",
        ]) ||
        data.version !== constants.SHORTCUT_VERSION ||
        data.generation !== entry.shortcutGeneration ||
        !Array.isArray(data.commands) ||
        !Array.isArray(data.actions) ||
        data.commands.length > 256 ||
        data.actions.length > constants.CHILD_SHORTCUT_ACTIONS.size ||
        new Set(data.commands).size !== data.commands.length ||
        new Set(data.actions).size !== data.actions.length ||
        data.commands.some(
          (id: unknown) => typeof id !== "string" || !ctx.commandsById.has(id),
        ) ||
        data.actions.some(
          (action: unknown) =>
            typeof action !== "string" ||
            !constants.CHILD_SHORTCUT_ACTIONS.has(action),
        )
      )
        return true;
      entry.shortcutProtocol = constants.SHORTCUT_VERSION;
      entry.shortcutActions = new Set(data.actions);
      if (ctx.state.commandDialogState?.mode === "palette")
        ctx.services.renderCommandPalette();
      return true;
    }
    if (
      !ctx.services.shortcutFrameActive(entry) ||
      !data ||
      typeof data !== "object" ||
      data.type !== constants.SHORTCUT_INTENT_MESSAGE
    )
      return false;
    if (data.version === constants.LEGACY_SHORTCUT_VERSION) {
      if (
        !ctx.services.exactMessageKeys(data, [
          "type",
          "version",
          "intentId",
          "shortcutId",
        ]) ||
        !ctx.services.validCorrelationId(data.intentId) ||
        typeof data.shortcutId !== "string"
      )
        return true;
      const legacy = constants.LEGACY_SHORTCUTS.find(
        (candidate) => candidate.id === data.shortcutId,
      );
      const command = legacy && ctx.commandsById.get(legacy.commandId);
      const enabled = command?.bindings.some(
        (binding) =>
          binding.kind === "direct" &&
          ctx.services.commandBindingLabel(binding) === legacy!.label,
      );
      if (
        !legacy ||
        !command ||
        !enabled ||
        ctx.state.recentShortcutIntents.has(data.intentId)
      )
        return true;
      entry.shortcutProtocol = constants.LEGACY_SHORTCUT_VERSION;
      entry.shortcutActions = new Set(["fit-pane-width"]);
      ctx.state.recentShortcutIntents.add(data.intentId);
      if (ctx.state.recentShortcutIntents.size > 64) {
        const oldest = ctx.state.recentShortcutIntents.values().next().value;
        if (oldest !== undefined)
          ctx.state.recentShortcutIntents.delete(oldest);
      }
      ctx.services.dispatchCommand(command.id, {
        source: "shortcut",
        bindingLabel: legacy.label,
        childOriginated: true,
      });
      return true;
    }
    if (
      !ctx.services.exactMessageKeys(data, [
        "type",
        "version",
        "generation",
        "intentId",
        "commandId",
        "bindingLabel",
      ]) ||
      data.version !== constants.SHORTCUT_VERSION ||
      entry.shortcutProtocol !== constants.SHORTCUT_VERSION ||
      data.generation !== entry.shortcutGeneration ||
      !ctx.services.validCorrelationId(data.intentId) ||
      typeof data.commandId !== "string" ||
      typeof data.bindingLabel !== "string"
    )
      return true;
    const command = ctx.commandsById.get(data.commandId);
    const validBinding = command?.bindings.some(
      (binding) =>
        data.bindingLabel === ctx.services.commandBindingLabel(binding),
    );
    if (
      !command ||
      !validBinding ||
      ctx.state.recentShortcutIntents.has(data.intentId)
    )
      return true;
    ctx.state.recentShortcutIntents.add(data.intentId);
    if (ctx.state.recentShortcutIntents.size > 64) {
      const oldest = ctx.state.recentShortcutIntents.values().next().value;
      if (oldest !== undefined) ctx.state.recentShortcutIntents.delete(oldest);
    }
    ctx.services.dispatchCommand(command.id, {
      source: "shortcut",
      bindingLabel: data.bindingLabel,
      childOriginated: true,
    });
    return true;
  };
}
