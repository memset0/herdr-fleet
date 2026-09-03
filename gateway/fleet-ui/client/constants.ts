export const STORAGE_KEY = "herdr-web-remote:selected-instance";
export const RAIL_STORAGE_KEY = "herdr-web-remote:fleet-rail-widths:v1";
export const CACHE_STORAGE_KEY = "herdr-web-remote:fleet-iframe-cache:v1";
export const AGENT_FAVORITES_STORAGE_KEY =
  "herdr-web-remote:fleet-agent-favorites:v1";
export const ROUTE_MESSAGE = "herdr-web-remote:route";
export const FRAME_ACTIVITY_MESSAGE = "herdr-web-remote:activity";
export const FRAME_ACTIVITY_VERSION = 1;
export const ACTION_PROBE_MESSAGE = "herdr-web-remote:action-probe";
export const ACTION_READY_MESSAGE = "herdr-web-remote:action-ready";
export const ACTION_REQUEST_MESSAGE = "herdr-web-remote:action-request";
export const ACTION_RESULT_MESSAGE = "herdr-web-remote:action-result";
export const ACTION_VERSION = 1;
export const ACTION_PROBE_TIMEOUT_MS = 8_000;
export const ACTION_RESULT_TIMEOUT_MS = 25_000;
export const CLOSE_CONFIRM_MS = 3_000;
export const SHORTCUT_CONFIG_MESSAGE = "herdr-web-remote:shortcut-config";
export const SHORTCUT_INTENT_MESSAGE = "herdr-web-remote:shortcut-intent";
export const SHORTCUT_COMMAND_MESSAGE = "herdr-web-remote:shortcut-command";
export const SHORTCUT_RESULT_MESSAGE = "herdr-web-remote:shortcut-result";
export const SHORTCUT_READY_MESSAGE = "herdr-web-remote:shortcut-ready";
export const SHORTCUT_VERSION = 2;
export const LEGACY_SHORTCUT_VERSION = 1;
export const SHORTCUT_PREFIX_TIMEOUT_MS = 2_000;
export const SHORTCUT_COMMAND_TIMEOUT_MS = 18_000;
export const DEFAULT_REFRESH_MS = 5_000;
export const MIN_REFRESH_TIMER_MS = 250;
export const FRAME_CACHE_QUIET_MS = 30 * 60 * 1_000;
export const DESKTOP_MEDIA = "(min-width: 1200px)";
export const TERMINAL_DESKTOP_MEDIA =
  "(min-width: 1200px) and (hover: hover) and (pointer: fine)";
export const LEGACY_SHORTCUTS = [
  {
    id: "resize-current-pane",
    commandId: "fit-pane-width",
    code: "KeyS",
    label: "Alt+S",
  },
  {
    id: "previous-pane",
    commandId: "previous-pane",
    code: "KeyK",
    label: "Alt+K",
  },
  { id: "next-pane", commandId: "next-pane", code: "KeyJ", label: "Alt+J" },
  {
    id: "previous-agent",
    commandId: "previous-agent",
    code: "KeyH",
    label: "Alt+H",
  },
  { id: "next-agent", commandId: "next-agent", code: "KeyL", label: "Alt+L" },
  ...Array.from({ length: 9 }, (_, index) => ({
    id: `select-agent-${index + 1}`,
    commandId: `select-agent-${index + 1}`,
    code: `Digit${index + 1}`,
    label: `Alt+${index + 1}`,
  })),
] as const;

export const CHILD_SHORTCUT_ACTIONS = new Set([
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
