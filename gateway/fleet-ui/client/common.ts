import * as constants from "./constants.ts";
import type { FleetClientContext } from "./context.ts";

export function installCommon(ctx: FleetClientContext): void {
  ctx.services.healthLabel = (health) =>
    (
      ({
        online: "Online",
        "herdr-down": "Herdr unavailable",
        "bridge-down": "Collie unavailable",
        "transport-down": "Transport unavailable",
      }) as Record<string, string>
    )[String(health)] || "Unavailable";
  ctx.services.statusLabel = (status) =>
    (
      ({
        blocked: "needs you",
        working: "working",
        done: "done",
        idle: "idle",
        unknown: "unknown",
      }) as Record<string, string>
    )[String(status)] || "unknown";
  ctx.services.statusColor = (status) =>
    "var(--status-" +
    (["blocked", "working", "done", "idle", "unknown"].includes(status)
      ? status
      : "unknown") +
    ")";
  ctx.services.remembered = () => {
    try {
      return ctx.runtime.storage.getItem(constants.STORAGE_KEY);
    } catch {
      return null;
    }
  };
  ctx.services.remember = (id) => {
    try {
      ctx.runtime.storage.setItem(constants.STORAGE_KEY, id);
    } catch {}
  };
  ctx.services.requested = () =>
    new URL(ctx.runtime.location.href).searchParams.get("instance");
  ctx.services.nodeOrigin = (node) =>
    new URL("https://" + node.publicHost + "/").origin;
  ctx.services.selectedNode = () =>
    ctx.state.nodes.find((node) => node.id === ctx.state.selectedId) || null;
  ctx.services.announce = (message) => {
    ctx.elements.fleetStatus.textContent = message;
  };
  ctx.services.validPane = (value) =>
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
      ? value
      : null;
  ctx.services.validTerminalSession = (value) =>
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)
      ? value
      : null;
  ctx.services.validSession = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed &&
      trimmed.length <= 128 &&
      !/[\u0000-\u001f\u007f]/.test(trimmed)
      ? trimmed
      : null;
  };
  ctx.services.element = (tag, className, text) => {
    const value = ctx.runtime.document.createElement(tag);
    if (className) value.className = className;
    if (text !== undefined) value.textContent = String(text);
    return value;
  };
  ctx.services.initials = (value) =>
    String(value || "")
      .trim()
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";
  ctx.services.brand = (value) => {
    const key = String(value || "")
      .trim()
      .toLowerCase();
    if (key.startsWith("claude")) return "claude";
    if (key.startsWith("codex")) return "codex";
    if (key.startsWith("opencode")) return "opencode";
    if (key === "pi" || key.startsWith("pi-") || key.startsWith("pi."))
      return "pi";
    return "unknown";
  };
  ctx.services.baseName = (value) =>
    String(value || "")
      .replace(/[\/\\]+$/, "")
      .split(/[\/\\]/)
      .pop() || "";
  ctx.services.shortCwd = (value) => {
    const parts = String(value || "")
      .split(/[\/\\]/)
      .filter(Boolean);
    return parts.length > 2
      ? "…/" + parts.slice(-2).join("/")
      : String(value || "");
  };
  ctx.services.formatDelay = (ms) =>
    ms >= 3600000
      ? "1h"
      : ms >= 60000
        ? Math.round(ms / 60000) + "m"
        : Math.round(ms / 1000) + "s";
  ctx.services.timeAgo = (at) => {
    const seconds = Math.max(0, Math.floor((ctx.runtime.now() - at) / 1000));
    if (seconds < 60) return seconds + "s";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + "m";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h";
    return Math.floor(hours / 24) + "d";
  };
  ctx.services.shortcutPaneKey = (nodeId, paneId, session) =>
    [nodeId, paneId, session || ""].join("|");
}
