import * as constants from "./constants.ts";
import type { FleetClientContext } from "./context.ts";

export function installActions(ctx: FleetClientContext): void {
  ctx.services.exactMessageKeys = function (value, allowed) {
    return Object.keys(value).every((key) => allowed.includes(key));
  };

  ctx.services.validActionResult = function (data, action, requestId) {
    if (
      !data ||
      typeof data !== "object" ||
      data.type !== constants.ACTION_RESULT_MESSAGE ||
      data.version !== constants.ACTION_VERSION ||
      data.requestId !== requestId ||
      data.action !== action ||
      typeof data.ok !== "boolean"
    )
      return false;
    if (!data.ok)
      return (
        ctx.services.exactMessageKeys(data, [
          "type",
          "version",
          "requestId",
          "action",
          "ok",
          "error",
        ]) &&
        typeof data.error === "string" &&
        data.error.length > 0 &&
        data.error.length <= 240
      );
    if (action === "create-workspace" || action === "create-tab") {
      if (
        !ctx.services.exactMessageKeys(data, [
          "type",
          "version",
          "requestId",
          "action",
          "ok",
          "pane",
        ]) ||
        !data.pane ||
        typeof data.pane !== "object" ||
        !ctx.services.exactMessageKeys(data.pane, [
          "paneId",
          "workspaceId",
          "tabId",
        ])
      )
        return false;
      return Boolean(
        ctx.services.validPane(data.pane.paneId) &&
          ctx.services.validPane(data.pane.workspaceId) &&
          ctx.services.validPane(data.pane.tabId),
      );
    }
    return ctx.services.exactMessageKeys(data, [
      "type",
      "version",
      "requestId",
      "action",
      "ok",
    ]);
  };

  ctx.services.finishPendingAction = function (result, error = null) {
    const state = ctx.state.pendingAction;
    if (!state) return;
    ctx.runtime.clearTimeout(state.probeTimer);
    ctx.runtime.clearTimeout(state.timeout);
    if (state.temporary) state.frame.remove();
    ctx.state.pendingAction = null;
    delete ctx.elements.shell.dataset.actionBusy;
    if (error) state.reject(error);
    else state.resolve(result);
  };

  ctx.services.failPendingAction = function (message) {
    ctx.services.finishPendingAction(null, new Error(message));
  };

  ctx.services.postActionProbe = function () {
    const state = ctx.state.pendingAction;
    if (!state || state.phase !== "probing") return;
    const target = state.frame.contentWindow;
    if (!target) return;
    target.postMessage(
      {
        type: constants.ACTION_PROBE_MESSAGE,
        version: constants.ACTION_VERSION,
        requestId: state.requestId,
      },
      state.origin,
    );
    ctx.runtime.clearTimeout(state.probeTimer);
    state.probeTimer = ctx.runtime.setTimeout(
      ctx.services.postActionProbe,
      500,
    );
  };

  ctx.services.sendPendingAction = function () {
    const state = ctx.state.pendingAction;
    if (!state || state.phase !== "probing") return;
    const target = state.frame.contentWindow;
    if (!target) {
      ctx.services.failPendingAction("Collie page is unavailable.");
      return;
    }
    state.phase = "sent";
    ctx.runtime.clearTimeout(state.probeTimer);
    ctx.runtime.clearTimeout(state.timeout);
    target.postMessage(state.request, state.origin);
    state.timeout = ctx.runtime.setTimeout(
      () =>
        ctx.services.failPendingAction(
          "Collie did not confirm the action. Check the node before trying again.",
        ),
      constants.ACTION_RESULT_TIMEOUT_MS,
    );
  };

  ctx.services.handleActionMessage = function (event) {
    const state = ctx.state.pendingAction;
    if (
      !state ||
      event.source !== state.frame.contentWindow ||
      event.origin !== state.origin
    )
      return false;
    const data = event.data;
    if (
      data &&
      typeof data === "object" &&
      data.type === constants.ACTION_READY_MESSAGE
    ) {
      if (
        state.phase !== "probing" ||
        !ctx.services.exactMessageKeys(data, [
          "type",
          "version",
          "requestId",
        ]) ||
        data.version !== constants.ACTION_VERSION ||
        data.requestId !== state.requestId
      )
        return true;
      ctx.services.sendPendingAction();
      return true;
    }
    if (
      !ctx.services.validActionResult(
        data,
        state.request.action,
        state.requestId,
      )
    )
      return true;
    ctx.services.finishPendingAction(data);
    return true;
  };

  ctx.services.dispatchNodeAction = function (node, payload) {
    if (ctx.state.pendingAction)
      return Promise.reject(
        new Error("Another sidebar action is still running."),
      );
    const origin = ctx.services.nodeOrigin(node);
    const resident = ctx.state.frameRegistry.get(node.id);
    const frame =
      resident?.frame || ctx.runtime.document.createElement("iframe");
    const temporary = !resident;
    if (temporary) {
      frame.className = "node-frame action-frame";
      frame.title = "Collie action · " + node.name;
      frame.allow = "clipboard-read; clipboard-write";
      frame.hidden = true;
      ctx.elements.frameStage.prepend(frame);
    }
    const requestId = ctx.services.actionRequestId();
    const request = {
      type: constants.ACTION_REQUEST_MESSAGE,
      version: constants.ACTION_VERSION,
      requestId,
      ...payload,
    };
    return new Promise((resolve, reject) => {
      ctx.state.pendingAction = {
        nodeId: node.id,
        origin,
        frame,
        temporary,
        requestId,
        request,
        phase: "probing",
        resolve,
        reject,
        probeTimer: null,
        timeout: null,
      };
      ctx.elements.shell.dataset.actionBusy = "true";
      frame.addEventListener(
        "load",
        () => {
          const target = frame.contentWindow;
          if (target)
            target.postMessage(
              {
                type: constants.FRAME_ACTIVITY_MESSAGE,
                version: constants.FRAME_ACTIVITY_VERSION,
                active: false,
              },
              origin,
            );
          ctx.services.postActionProbe();
        },
        { once: true },
      );
      ctx.state.pendingAction.probeTimer = ctx.runtime.setTimeout(
        ctx.services.postActionProbe,
        0,
      );
      ctx.state.pendingAction.timeout = ctx.runtime.setTimeout(
        () =>
          ctx.services.failPendingAction(
            "This Collie version does not support sidebar actions, or the node is unavailable.",
          ),
        constants.ACTION_PROBE_TIMEOUT_MS,
      );
      if (temporary)
        frame.src = ctx.services.frameHref(origin, { view: "home" });
      else ctx.services.postActionProbe();
    });
  };
}
