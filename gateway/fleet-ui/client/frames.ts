import * as constants from "./constants.ts";
import type { FleetClientContext } from "./context.ts";
import {
  fleetFrameActivityActive,
  fleetIframeEvictionCandidate,
} from "../model/frames.ts";

export function installFrames(ctx: FleetClientContext): void {
  ctx.services.frameActivityActive = function (entry) {
    return fleetFrameActivityActive({
      selected: entry.id === ctx.state.selectedId,
      frameHidden: entry.frame.hidden,
      documentHidden: ctx.runtime.document.hidden,
      desktop: ctx.desktopMedia.matches,
      treeOpen: ctx.state.treeOpen,
      agentMenuHidden: Boolean(ctx.elements.agentMenu.hidden),
    });
  };

  ctx.services.postFrameActivity = function (entry) {
    const target = entry.frame.contentWindow;
    if (!target) return false;
    target.postMessage(
      {
        type: constants.FRAME_ACTIVITY_MESSAGE,
        version: constants.FRAME_ACTIVITY_VERSION,
        active: ctx.services.frameActivityActive(entry),
      },
      entry.origin,
    );
    return true;
  };

  ctx.services.shortcutFrameActive = function (entry) {
    return (
      ctx.desktopMedia.matches &&
      !ctx.runtime.document.hidden &&
      entry.id === ctx.state.selectedId &&
      !entry.frame.hidden
    );
  };

  ctx.services.postFrameShortcutConfig = function (entry) {
    const target = entry.frame.contentWindow;
    if (!target) return false;
    ctx.state.shortcutGeneration =
      ctx.state.shortcutGeneration >= Number.MAX_SAFE_INTEGER
        ? 0
        : ctx.state.shortcutGeneration + 1;
    entry.shortcutGeneration = ctx.state.shortcutGeneration;
    entry.shortcutProtocol = null;
    entry.shortcutActions = new Set();
    const prefix = {
      code: ctx.shortcutPrefix.code,
      altKey: ctx.shortcutPrefix.altKey,
      ctrlKey: ctx.shortcutPrefix.ctrlKey,
      metaKey: ctx.shortcutPrefix.metaKey,
      shiftKey: ctx.shortcutPrefix.shiftKey,
      label: ctx.shortcutPrefix.label,
    };
    const bindings = ctx.shortcutBindings.map(
      ({
        commandId,
        kind,
        code,
        altKey,
        ctrlKey,
        metaKey,
        shiftKey,
        label,
      }) => ({
        commandId,
        kind,
        code,
        altKey,
        ctrlKey,
        metaKey,
        shiftKey,
        label,
      }),
    );
    target.postMessage(
      {
        type: constants.SHORTCUT_CONFIG_MESSAGE,
        version: constants.SHORTCUT_VERSION,
        generation: ctx.state.shortcutGeneration,
        active: ctx.services.shortcutFrameActive(entry),
        prefix,
        bindings,
      },
      entry.origin,
    );
    const legacyBindings = constants.LEGACY_SHORTCUTS.filter((legacy) =>
      ctx.commandsById
        .get(legacy.commandId)
        ?.bindings.some(
          (binding) =>
            binding.kind === "direct" &&
            binding.code === legacy.code &&
            binding.altKey === true &&
            !binding.ctrlKey &&
            !binding.metaKey &&
            !binding.shiftKey,
        ),
    ).map((legacy) => ({
      id: legacy.id,
      code: legacy.code,
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    }));
    target.postMessage(
      {
        type: constants.SHORTCUT_CONFIG_MESSAGE,
        version: constants.LEGACY_SHORTCUT_VERSION,
        generation: ctx.state.shortcutGeneration,
        active: ctx.services.shortcutFrameActive(entry),
        bindings: legacyBindings,
      },
      entry.origin,
    );
    return true;
  };

  ctx.services.broadcastFrameActivity = function () {
    for (const entry of ctx.state.frameRegistry.values()) {
      ctx.services.postFrameActivity(entry);
      ctx.services.postFrameShortcutConfig(entry);
    }
  };

  ctx.services.releaseFrame = function (id, allowSelected = false) {
    if (!allowSelected && id === ctx.state.selectedId) return false;
    const entry = ctx.state.frameRegistry.get(id);
    if (!entry) return false;
    if (ctx.state.pendingShortcutCommand?.frame === entry.frame)
      ctx.services.finishPendingShortcutCommand(
        null,
        "Selected Collie page was released.",
      );
    entry.frame.remove();
    ctx.state.frameRegistry.delete(id);
    return true;
  };

  ctx.services.evictionCandidate = function () {
    const id = fleetIframeEvictionCandidate(
      [...ctx.state.frameRegistry.values()],
      ctx.state.selectedId,
    );
    return id ? (ctx.state.frameRegistry.get(id) ?? null) : null;
  };

  ctx.services.makeFrame = function (node) {
    while (ctx.state.frameRegistry.size >= ctx.state.iframeCacheSize) {
      const candidate = ctx.services.evictionCandidate();
      if (!candidate) break;
      ctx.services.releaseFrame(candidate.id);
    }
    const origin = ctx.services.nodeOrigin(node);
    const value = ctx.runtime.document.createElement("iframe");
    value.className = "node-frame";
    value.title = "Collie · " + node.name;
    value.allow = "clipboard-read; clipboard-write";
    value.hidden = true;
    const entry = {
      id: node.id,
      origin,
      frame: value,
      route: { view: "home" as const },
      frameKey: null,
      lastVisitedAt: 0,
      loaded: false,
      loading: false,
      shortcutGeneration: -1,
      shortcutProtocol: null,
      shortcutActions: new Set<string>(),
    };
    value.addEventListener("load", () => {
      entry.loaded = true;
      entry.loading = false;
      if (ctx.state.selectedId === entry.id) {
        ctx.elements.loading.hidden = true;
        ctx.services.announce(node.name + " Collie loaded.");
      }
      ctx.services.postFrameActivity(entry);
      ctx.services.postFrameShortcutConfig(entry);
    });
    ctx.elements.frameStage.prepend(value);
    ctx.state.frameRegistry.set(entry.id, entry);
    return entry;
  };

  ctx.services.ensureFrame = function (node) {
    const origin = ctx.services.nodeOrigin(node);
    let entry = ctx.state.frameRegistry.get(node.id);
    if (entry && entry.origin !== origin) {
      ctx.services.releaseFrame(node.id, true);
      entry = undefined;
    }
    if (entry) return entry;
    return ctx.services.makeFrame(node);
  };

  ctx.services.showOnlyFrame = function (entry) {
    for (const resident of ctx.state.frameRegistry.values())
      resident.frame.hidden = resident !== entry;
    ctx.elements.empty.hidden = true;
    ctx.elements.loading.hidden = !entry.loading;
    ctx.services.broadcastFrameActivity();
  };

  ctx.services.scheduleQuietCleanup = function () {
    if (ctx.state.quietTimer !== null) {
      ctx.runtime.clearTimeout(ctx.state.quietTimer);
      ctx.state.quietTimer = null;
    }
    const remaining =
      constants.FRAME_CACHE_QUIET_MS -
      (ctx.runtime.now() - ctx.state.lastFrameVisitAt);
    if (remaining <= 0) {
      ctx.services.quietCleanup();
      return;
    }
    ctx.state.quietTimer = ctx.runtime.setTimeout(
      () => {
        ctx.state.quietTimer = null;
        ctx.services.quietCleanup();
      },
      Math.max(250, remaining),
    );
  };

  ctx.services.quietCleanup = function () {
    const remaining =
      constants.FRAME_CACHE_QUIET_MS -
      (ctx.runtime.now() - ctx.state.lastFrameVisitAt);
    if (remaining > 0) {
      ctx.services.scheduleQuietCleanup();
      return;
    }
    for (const id of [...ctx.state.frameRegistry.keys()]) {
      if (id !== ctx.state.selectedId) ctx.services.releaseFrame(id);
    }
  };

  ctx.services.visitFrame = function (entry) {
    const now = ctx.runtime.now();
    entry.lastVisitedAt = now;
    ctx.state.lastFrameVisitAt = now;
    ctx.services.scheduleQuietCleanup();
  };

  ctx.services.reconcileFrames = function () {
    const inventory = new Map(
      ctx.state.nodes.map((node) => [node.id, ctx.services.nodeOrigin(node)]),
    );
    for (const entry of [...ctx.state.frameRegistry.values()]) {
      if (inventory.get(entry.id) !== entry.origin)
        ctx.services.releaseFrame(entry.id, true);
    }
  };
}
