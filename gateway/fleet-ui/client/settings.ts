import * as constants from "./constants.ts";
import type { FleetClientContext } from "./context.ts";
import {
  fleetAgentFavoriteKey,
  fleetAgentFavoritePreference,
} from "../model/agents.ts";
import { fleetIframeCachePreference } from "../model/frames.ts";

export function installSettings(ctx: FleetClientContext): void {
  ctx.services.readIframeCachePreference = function () {
    let serialized: string | null = null;
    try {
      serialized = ctx.runtime.storage.getItem(constants.CACHE_STORAGE_KEY);
    } catch {}
    return fleetIframeCachePreference(serialized, ctx.state.defaultCacheSize);
  };

  ctx.services.persistIframeCachePreference = function (size) {
    try {
      ctx.runtime.storage.setItem(
        constants.CACHE_STORAGE_KEY,
        JSON.stringify({ version: 1, size }),
      );
    } catch {}
  };

  ctx.services.agentFavoriteKey = function (node, agent) {
    return fleetAgentFavoriteKey({
      nodeId: node.id,
      herdrSession: agent.herdrSession,
      paneId: agent.paneId,
      agent: agent.agent,
    });
  };

  ctx.services.readAgentFavorites = function () {
    let serialized: string | null = null;
    try {
      serialized = ctx.runtime.storage.getItem(
        constants.AGENT_FAVORITES_STORAGE_KEY,
      );
    } catch {}
    return fleetAgentFavoritePreference(serialized);
  };

  ctx.services.persistAgentFavorites = function () {
    try {
      ctx.runtime.storage.setItem(
        constants.AGENT_FAVORITES_STORAGE_KEY,
        JSON.stringify({ version: 1, keys: [...ctx.state.agentFavorites] }),
      );
    } catch {}
  };

  ctx.services.showTreeActionStatus = function (message, kind = "success") {
    if (ctx.state.actionStatusTimer !== null) {
      ctx.runtime.clearTimeout(ctx.state.actionStatusTimer);
      ctx.state.actionStatusTimer = null;
    }
    ctx.elements.treeActionStatus.textContent = message;
    ctx.elements.treeActionStatus.dataset.kind = kind;
    ctx.elements.treeActionStatus.hidden = false;
    ctx.services.announce(message);
    ctx.state.actionStatusTimer = ctx.runtime.setTimeout(() => {
      ctx.state.actionStatusTimer = null;
      ctx.elements.treeActionStatus.hidden = true;
      delete ctx.elements.treeActionStatus.dataset.kind;
    }, 5000);
  };

  ctx.services.showCommandToast = function (command, bindingLabel = null) {
    if (ctx.state.shortcutToastTimer !== null) {
      ctx.runtime.clearTimeout(ctx.state.shortcutToastTimer);
      ctx.state.shortcutToastTimer = null;
    }
    ctx.elements.shortcutToast.textContent =
      (bindingLabel ? bindingLabel + " · " : "") + command.name;
    ctx.elements.shortcutToast.dataset.visible = "true";
    ctx.elements.shortcutToast.setAttribute("aria-hidden", "false");
    ctx.state.shortcutToastTimer = ctx.runtime.setTimeout(() => {
      ctx.state.shortcutToastTimer = null;
      delete ctx.elements.shortcutToast.dataset.visible;
      ctx.elements.shortcutToast.setAttribute("aria-hidden", "true");
    }, 1800);
  };

  ctx.services.shrinkFrameCache = function () {
    while (ctx.state.frameRegistry.size > ctx.state.iframeCacheSize) {
      const candidate = ctx.services.evictionCandidate();
      if (!candidate) break;
      ctx.services.releaseFrame(candidate.id);
    }
  };

  ctx.services.setIframeCacheSize = function (value, { persist = true } = {}) {
    const size = Number(value);
    if (!Number.isSafeInteger(size) || size < 1 || size > 10) return false;
    ctx.state.iframeCacheSize = size;
    ctx.elements.cacheSizeSelect.value = String(size);
    if (persist) ctx.services.persistIframeCachePreference(size);
    ctx.services.shrinkFrameCache();
    ctx.services.announce("Iframe cache set to " + size + ".");
    return true;
  };

  ctx.services.closeSettings = function ({ restoreFocus = false } = {}) {
    ctx.elements.settingsPopover.hidden = true;
    ctx.elements.settingsToggle.setAttribute("aria-expanded", "false");
    if (restoreFocus) ctx.elements.settingsToggle.focus();
  };

  ctx.services.openSettings = function () {
    if (!ctx.desktopMedia.matches && !ctx.state.treeOpen) return false;
    if (ctx.state.sidebarsCollapsed) ctx.services.setSidebarsCollapsed(false);
    ctx.services.closeTreeContextMenu();
    ctx.services.closeCommandDialog();
    ctx.services.cancelSpaceClose();
    ctx.elements.settingsPopover.hidden = false;
    ctx.elements.settingsToggle.setAttribute("aria-expanded", "true");
    ctx.elements.cacheSizeSelect.value = String(ctx.state.iframeCacheSize);
    ctx.elements.cacheSizeSelect.focus();
    return true;
  };
}
