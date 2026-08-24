import { GATEWAY_THEME_CSS } from "./theme.ts";

function documentShell(title: string, body: string, assets: string[]): string {
  const tags = assets
    .map((asset) =>
      asset.endsWith(".css")
        ? `<link rel="stylesheet" href="${asset}">`
        : `<script type="module" src="${asset}"></script>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <title>${title}</title>
  ${tags}
</head>
<body>${body}</body>
</html>`;
}

export function fleetRefreshWaitMs(nextAt: number, generatedAt: number, fallbackMs = 5_000): number {
  if (!Number.isSafeInteger(nextAt) || !Number.isSafeInteger(generatedAt) || nextAt < 0 || generatedAt < 0) {
    return fallbackMs;
  }
  return Math.max(250, nextAt - generatedAt);
}

interface FleetAgentTriageInput {
  reachable: boolean;
  status: string;
  lastActiveAt?: number;
  lastSeenAt?: number;
}

export function fleetAgentBucket(
  agent: FleetAgentTriageInput,
): "needs" | "ready" | "working" | "recent" {
  if (agent.status === "blocked") return "needs";
  if (agent.status === "done" && (agent.lastActiveAt ?? 0) > (agent.lastSeenAt ?? 0)) return "ready";
  if (agent.status === "working") return "working";
  return "recent";
}

export function fleetHeaderAgentCount(agents: readonly FleetAgentTriageInput[]): number {
  return agents.filter((agent) => fleetAgentBucket(agent) !== "recent").length;
}

export function fleetAttentionResetEligible(agent: FleetAgentTriageInput): boolean {
  if (!agent.reachable) return false;
  const bucket = fleetAgentBucket(agent);
  return bucket === "ready" || bucket === "needs";
}

export const FLEET_AGENT_FAVORITES_MAX = 256;

export interface FleetAgentFavoriteIdentity {
  nodeId: string;
  herdrSession: string;
  paneId: string;
  agent: string;
}

function validFavoritePart(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 128 && !/[\u0000-\u001f\u007f]/.test(value);
}

export function fleetAgentFavoriteKey(identity: FleetAgentFavoriteIdentity): string | null {
  const parts = [identity.nodeId, identity.herdrSession, identity.paneId, identity.agent];
  return parts.every(validFavoritePart) ? JSON.stringify(parts) : null;
}

function validFavoriteKey(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 600) return false;
  try {
    const parts: unknown = JSON.parse(value);
    return Array.isArray(parts) && parts.length === 4 && parts.every(validFavoritePart);
  } catch {
    return false;
  }
}

export function fleetAgentFavoritePreference(serialized: string | null): Set<string> {
  if (!serialized) return new Set();
  try {
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== "object") return new Set();
    const record = value as Record<string, unknown>;
    if (record.version !== 1 || !Array.isArray(record.keys) || record.keys.length > FLEET_AGENT_FAVORITES_MAX) {
      return new Set();
    }
    const keys = record.keys;
    if (!keys.every(validFavoriteKey) || new Set(keys).size !== keys.length) return new Set();
    return new Set(keys);
  } catch {
    return new Set();
  }
}

export function fleetAgentFavoriteCompare(leftKey: string, rightKey: string, favorites: ReadonlySet<string>): number {
  return Number(favorites.has(rightKey)) - Number(favorites.has(leftKey));
}

export type FleetShortcutAction =
  | { kind: "resize-current-pane" }
  | { kind: "cycle-pane"; delta: -1 | 1 }
  | { kind: "cycle-agent"; delta: -1 | 1 }
  | { kind: "select-agent"; ordinal: number };

export interface FleetShortcutDefinition {
  id: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  scope: "desktop";
  label: string;
  keyLabel: string;
  action: FleetShortcutAction;
}

const exactAlt = { altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, scope: "desktop" as const };

export const FLEET_SHORTCUTS: readonly FleetShortcutDefinition[] = [
  { id: "resize-current-pane", code: "KeyS", ...exactAlt, label: "Resize current Pane", keyLabel: "Alt+S", action: { kind: "resize-current-pane" } },
  { id: "previous-pane", code: "KeyK", ...exactAlt, label: "Previous Pane", keyLabel: "Alt+K", action: { kind: "cycle-pane", delta: -1 } },
  { id: "next-pane", code: "KeyJ", ...exactAlt, label: "Next Pane", keyLabel: "Alt+J", action: { kind: "cycle-pane", delta: 1 } },
  { id: "previous-agent", code: "KeyH", ...exactAlt, label: "Previous Agent", keyLabel: "Alt+H", action: { kind: "cycle-agent", delta: -1 } },
  { id: "next-agent", code: "KeyL", ...exactAlt, label: "Next Agent", keyLabel: "Alt+L", action: { kind: "cycle-agent", delta: 1 } },
  ...Array.from({ length: 9 }, (_, index): FleetShortcutDefinition => {
    const ordinal = index + 1;
    return { id: `select-agent-${ordinal}`, code: `Digit${ordinal}`, ...exactAlt, label: `Select Agent ${ordinal}`, keyLabel: `Alt+${ordinal}`, action: { kind: "select-agent", ordinal } };
  }),
];

export function fleetShortcutRegistryValid(registry: readonly FleetShortcutDefinition[]): boolean {
  const ids = new Set<string>();
  const chords = new Set<string>();
  for (const shortcut of registry) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(shortcut.id) || ids.has(shortcut.id)) return false;
    if (!/^(?:Key[A-Z]|Digit[1-9])$/.test(shortcut.code) || shortcut.scope !== "desktop") return false;
    const chord = [shortcut.code, shortcut.altKey, shortcut.ctrlKey, shortcut.metaKey, shortcut.shiftKey].join("|");
    if (chords.has(chord) || !shortcut.label || !shortcut.keyLabel) return false;
    ids.add(shortcut.id);
    chords.add(chord);
  }
  return registry.length > 0;
}

export interface FleetShortcutEventLike {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
}

export function fleetShortcutMatch(
  event: FleetShortcutEventLike,
  desktop: boolean,
  registry: readonly FleetShortcutDefinition[] = FLEET_SHORTCUTS,
): FleetShortcutDefinition | null {
  if (!desktop || event.repeat) return null;
  return registry.find((shortcut) =>
    shortcut.code === event.code
    && shortcut.altKey === event.altKey
    && shortcut.ctrlKey === event.ctrlKey
    && shortcut.metaKey === event.metaKey
    && shortcut.shiftKey === event.shiftKey
  ) ?? null;
}

if (!fleetShortcutRegistryValid(FLEET_SHORTCUTS)) throw new Error("invalid Fleet shortcut registry");

export function fleetShortcutCycleIndex(
  targetKeys: readonly string[],
  currentKey: string,
  delta: -1 | 1,
): number | null {
  if (targetKeys.length === 0) return null;
  const currentIndex = targetKeys.indexOf(currentKey);
  if (currentIndex < 0) return null;
  return (currentIndex + delta + targetKeys.length) % targetKeys.length;
}

export type FleetTreeTabMode = "empty" | "direct" | "branch";

export function fleetTreeTabMode(panes: readonly { paneId?: unknown }[]): FleetTreeTabMode {
  const ids = new Set<string>();
  for (const pane of panes) {
    if (typeof pane.paneId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(pane.paneId)) continue;
    ids.add(pane.paneId);
  }
  if (ids.size === 0) return "empty";
  return ids.size === 1 ? "direct" : "branch";
}

export const FLEET_IFRAME_CACHE_QUIET_MS = 30 * 60 * 1_000;

export interface FleetIframeCacheEntry {
  id: string;
  lastVisitedAt: number;
}

export function fleetIframeEvictionCandidate(
  entries: readonly FleetIframeCacheEntry[],
  selectedId: string | null,
): string | null {
  const candidate = entries
    .filter((entry) => entry.id !== selectedId)
    .sort((left, right) => left.lastVisitedAt - right.lastVisitedAt || left.id.localeCompare(right.id))[0];
  return candidate?.id ?? null;
}

export function fleetIframeCacheQuietExpired(now: number, lastVisitedAt: number): boolean {
  return Number.isFinite(now) && Number.isFinite(lastVisitedAt) && now - lastVisitedAt >= FLEET_IFRAME_CACHE_QUIET_MS;
}

export function fleetIframeCachePreference(serialized: string | null, configured: number): number {
  const fallback = Number.isSafeInteger(configured) && configured >= 1 && configured <= 10 ? configured : 1;
  if (!serialized) return fallback;
  try {
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== "object") return fallback;
    const record = value as Record<string, unknown>;
    return record.version === 1
      && Number.isSafeInteger(record.size)
      && Number(record.size) >= 1
      && Number(record.size) <= 10
      ? Number(record.size)
      : fallback;
  } catch {
    return fallback;
  }
}

export interface FleetFrameActivityInput {
  selected: boolean;
  frameHidden: boolean;
  documentHidden: boolean;
  desktop: boolean;
  treeOpen: boolean;
  agentMenuHidden: boolean;
}

export function fleetFrameActivityActive(input: FleetFrameActivityInput): boolean {
  return input.selected
    && !input.frameHidden
    && !input.documentHidden
    && (input.desktop || (!input.treeOpen && input.agentMenuHidden));
}

export interface FleetRailWidths {
  left: number;
  right: number;
}

export const FLEET_RAIL_WIDTHS = {
  leftDefault: 224,
  leftMin: 176,
  leftMax: 480,
  rightDefault: 336,
  rightMin: 256,
  rightMax: 576,
  centreMin: 640,
} as const;

function clampRailWidth(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function fleetRailWidths(
  preferred: Partial<FleetRailWidths> | null | undefined,
  viewportWidth: number,
): FleetRailWidths {
  const viewport = Number.isFinite(viewportWidth) && viewportWidth > 0 ? Math.floor(viewportWidth) : 1_200;
  let left = clampRailWidth(
    Number.isFinite(preferred?.left) ? Number(preferred?.left) : FLEET_RAIL_WIDTHS.leftDefault,
    FLEET_RAIL_WIDTHS.leftMin,
    FLEET_RAIL_WIDTHS.leftMax,
  );
  let right = clampRailWidth(
    Number.isFinite(preferred?.right) ? Number(preferred?.right) : FLEET_RAIL_WIDTHS.rightDefault,
    FLEET_RAIL_WIDTHS.rightMin,
    FLEET_RAIL_WIDTHS.rightMax,
  );
  const minimumRailTotal = FLEET_RAIL_WIDTHS.leftMin + FLEET_RAIL_WIDTHS.rightMin;
  const railBudget = Math.max(minimumRailTotal, viewport - FLEET_RAIL_WIDTHS.centreMin);
  let overflow = Math.max(0, left + right - railBudget);
  if (overflow > 0) {
    const leftFlex = left - FLEET_RAIL_WIDTHS.leftMin;
    const rightFlex = right - FLEET_RAIL_WIDTHS.rightMin;
    const flexTotal = leftFlex + rightFlex;
    const leftReduction = flexTotal > 0 ? Math.min(leftFlex, Math.floor((overflow * leftFlex) / flexTotal)) : 0;
    left -= leftReduction;
    overflow -= leftReduction;
    const rightReduction = Math.min(rightFlex, overflow);
    right -= rightReduction;
    overflow -= rightReduction;
    left -= Math.min(left - FLEET_RAIL_WIDTHS.leftMin, overflow);
  }
  return { left, right };
}

export function fleetRailResize(
  current: FleetRailWidths,
  side: "left" | "right",
  requestedWidth: number,
  viewportWidth: number,
): FleetRailWidths {
  const viewport = Number.isFinite(viewportWidth) && viewportWidth > 0 ? Math.floor(viewportWidth) : 1_200;
  const other = side === "left" ? current.right : current.left;
  const minimum = side === "left" ? FLEET_RAIL_WIDTHS.leftMin : FLEET_RAIL_WIDTHS.rightMin;
  const staticMaximum = side === "left" ? FLEET_RAIL_WIDTHS.leftMax : FLEET_RAIL_WIDTHS.rightMax;
  const maximum = Math.max(minimum, Math.min(staticMaximum, viewport - FLEET_RAIL_WIDTHS.centreMin - other));
  const fallback = side === "left" ? current.left : current.right;
  const width = clampRailWidth(Number.isFinite(requestedWidth) ? requestedWidth : fallback, minimum, maximum);
  return side === "left" ? { left: width, right: current.right } : { left: current.left, right: width };
}

export function fleetRailWidthPreferences(serialized: string | null): FleetRailWidths | null {
  if (!serialized) return null;
  try {
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (record.version !== 1 || !Number.isFinite(record.left) || !Number.isFinite(record.right)) return null;
    const left = Number(record.left);
    const right = Number(record.right);
    return left > 0 && right > 0 ? { left, right } : null;
  } catch {
    return null;
  }
}

/** Fleet creates the emergency entry only for the wide desktop presentation. */
export function fleetDesktopFallbackUrl(
  value: unknown,
  desktop: boolean,
  fleetOrigin: string,
  nodeId: string,
): string | null {
  if (!desktop || typeof value !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(nodeId)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === fleetOrigin && !url.username && !url.password && !url.port
      && url.pathname === `/ttyd/${nodeId}/` && !url.search && !url.hash
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function fleetPage(iframeCacheSize = 1, pluginVersion = "development"): string {
  const boundedCacheSize = Number.isSafeInteger(iframeCacheSize) && iframeCacheSize >= 1 && iframeCacheSize <= 10
    ? iframeCacheSize
    : 1;
  const safeVersion = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/.test(pluginVersion) ? pluginVersion : "unknown";
  const cacheOptions = Array.from({ length: 10 }, (_, index) => {
    const size = index + 1;
    return `<option value="${size}">${size}</option>`;
  }).join("");
  const shortcutRows = FLEET_SHORTCUTS.map((shortcut) =>
    `<li><span>${shortcut.label}</span><kbd>${shortcut.keyLabel}</kbd></li>`,
  ).join("");
  return documentShell(
    "Fleet · Collie",
    `<main class="fleet-shell" data-iframe-cache-size="${boundedCacheSize}" data-plugin-version="${safeVersion}">
      <header id="host-rail" class="fleet-header">
        <button id="tree-menu-toggle" class="fleet-mark fleet-tree-toggle" type="button" aria-expanded="false" aria-controls="instances" aria-label="Open Host tree" title="Hosts">H</button>
        <a class="fleet-mark fleet-home-mark" href="/" aria-label="Fleet home" title="Herdr Fleet">H</a>
        <nav id="host-switcher" class="host-switcher" aria-label="Herdr Host switcher" role="tablist">
          <span class="connecting">Connecting…</span>
        </nav>
        <nav id="instances" class="instance-strip" aria-label="Herdr Hosts" role="tree" aria-hidden="true" inert>
          <span class="connecting">Connecting…</span>
        </nav>
        <button id="agent-menu-toggle" class="header-action agent-menu-toggle" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="agent-menu" aria-label="Open all Agents" title="All Agents">
          <svg class="header-icon agent-menu-icon" data-icon="agent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <rect width="16" height="12" x="4" y="8" rx="2"></rect>
            <path d="M12 8V4H8"></path>
            <path d="M2 14h2"></path>
            <path d="M20 14h2"></path>
            <path d="M9 13v2"></path>
            <path d="M15 13v2"></path>
          </svg>
          <span id="agent-menu-count" class="agent-menu-count" aria-hidden="true">0</span>
        </button>
        <a id="open-node" class="header-action" href="#" target="_blank" rel="noopener noreferrer" aria-label="Open selected Collie in a new tab" title="Open in new tab" hidden>
          <svg class="header-icon" data-icon="external-link" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M15 3h6v6"></path>
            <path d="M10 14 21 3"></path>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          </svg>
        </a>
        <div id="tree-action-status" class="tree-action-status" role="status" hidden></div>
        <footer id="host-rail-footer" class="host-rail-footer">
          <span class="host-rail-version" aria-label="Web Remote version ${safeVersion}">v${safeVersion}</span>
          <div class="fleet-settings-anchor">
            <button id="fleet-settings-toggle" class="host-rail-settings" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="fleet-settings" aria-label="Fleet settings" title="Fleet settings">
              <svg class="header-icon" data-icon="settings" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <section id="fleet-settings" class="fleet-settings" role="dialog" aria-label="Fleet settings" hidden>
              <div class="fleet-settings-heading">
                <strong>Fleet settings</strong>
                <span>Browser only</span>
              </div>
              <label class="fleet-setting-row" for="iframe-cache-size">
                <span>
                  <strong>Cached pages</strong>
                  <small>Keep recently visited Hosts alive</small>
                </span>
                <select id="iframe-cache-size" aria-describedby="iframe-cache-default">${cacheOptions}</select>
              </label>
              <div class="fleet-settings-foot">
                <span id="iframe-cache-default">Default: ${boundedCacheSize}</span>
                <button id="iframe-cache-reset" type="button">Use default</button>
              </div>
              <section class="fleet-shortcuts" aria-labelledby="fleet-shortcuts-heading">
                <h2 id="fleet-shortcuts-heading">Shortcuts</h2>
                <ul>${shortcutRows}</ul>
              </section>
            </section>
          </div>
        </footer>
      </header>
      <button id="tree-menu-backdrop" class="tree-menu-backdrop" type="button" aria-label="Close Host tree" hidden></button>
      <aside id="agent-menu" class="agent-menu" aria-label="Agents across all Hosts" hidden>
        <div class="agent-menu-heading">
          <div>
            <p class="agent-menu-eyebrow">FLEET</p>
            <h1>All Agents</h1>
          </div>
          <span id="agent-refresh-state" class="agent-refresh-state" role="status">Refreshing…</span>
        </div>
        <div id="agent-sections" class="agent-sections"></div>
      </aside>
      <div id="host-rail-resizer" class="rail-resizer host-rail-resizer" role="separator" aria-label="Resize Host sidebar" aria-orientation="vertical" aria-controls="host-rail" tabindex="0"></div>
      <div id="agent-rail-resizer" class="rail-resizer agent-rail-resizer" role="separator" aria-label="Resize Agent sidebar" aria-orientation="vertical" aria-controls="agent-menu" tabindex="0"></div>
      <section id="frame-stage" class="frame-stage" aria-live="polite">
        <div id="frame-loading" class="frame-loading" hidden>
          <span class="loading-mark" aria-hidden="true">H</span>
          <span>Opening Collie…</span>
        </div>
        <aside id="node-notice" class="node-notice" role="status" hidden>
          <span id="notice-dot" class="status-dot"></span>
          <span id="notice-text" class="notice-text"></span>
          <button id="retry-frame" class="notice-action" type="button">Retry</button>
        </aside>
        <div id="empty-state" class="empty-state" hidden>
          <span class="empty-mark" aria-hidden="true">H</span>
          <h1 id="empty-title">No instances</h1>
          <p id="empty-copy">No enabled Herdr instances are configured.</p>
          <button id="retry-inventory" class="primary-action" type="button">Try again</button>
        </div>
      </section>
      <section id="tree-rename" class="tree-rename" role="dialog" aria-labelledby="tree-rename-title" hidden>
        <form id="tree-rename-form">
          <label id="tree-rename-title" for="tree-rename-input">Rename</label>
          <input id="tree-rename-input" type="text" maxlength="256" autocomplete="off" spellcheck="false">
          <p id="tree-rename-error" class="tree-rename-error" role="status" hidden></p>
          <div class="tree-rename-actions">
            <button id="tree-rename-cancel" type="button">Cancel</button>
            <button id="tree-rename-save" type="submit">Save</button>
          </div>
        </form>
      </section>
      <div id="shortcut-toast" class="shortcut-toast" role="status" aria-live="polite" aria-atomic="true" aria-hidden="true"></div>
      <p id="fleet-status" class="sr-only" role="status">Connecting to Fleet.</p>
    </main>`,
    ["/fleet-assets/fleet.css", "/fleet-assets/fleet.js"],
  );
}

export const FLEET_CSS = `${GATEWAY_THEME_CSS}
:root {
  --status-blocked: light-dark(oklch(.46 .2 25), oklch(.7 .2 24));
  --status-working: light-dark(oklch(.46 .12 72), oklch(.82 .15 82));
  --status-done: light-dark(oklch(.45 .14 152), oklch(.74 .16 152));
  --status-idle: light-dark(oklch(.45 .02 250), oklch(.65 .02 250));
  --status-unknown: light-dark(oklch(.43 .02 250), oklch(.6 .02 250));
  --status-online: var(--status-done);
  --status-down: var(--status-blocked);
  --tree-indicator-size: .5rem;
  --fleet-selected-foreground: light-dark(oklch(.985 0 0), oklch(.985 0 0));
}
html, body { height: 100%; overflow: hidden; }
body { margin: 0; background: var(--muted); color: var(--foreground); }
.fleet-shell {
  --fleet-host-rail-width: 14rem;
  --fleet-agent-rail-width: 21rem;
  position: relative;
  display: flex;
  height: 100dvh;
  width: 100%;
  flex-direction: column;
  overflow: hidden;
  background: var(--background);
  box-shadow: 0 0 0 1px var(--border), 0 18px 70px light-dark(#00000012, #00000070);
}
.fleet-header {
  z-index: 20;
  display: flex;
  min-height: calc(3.75rem + env(safe-area-inset-top));
  flex: none;
  align-items: flex-end;
  gap: .25rem;
  border-bottom: 1px solid var(--border);
  background: var(--muted);
  padding: .5rem .5rem .5rem .75rem;
  padding-top: calc(env(safe-area-inset-top) + .5rem);
}
.fleet-mark {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  flex: none;
  place-items: center;
  border: 0;
  border-radius: calc(var(--radius) - 2px);
  background: transparent;
  color: var(--foreground);
  font-size: 1rem;
  font-weight: 900;
  text-decoration: none;
  cursor: pointer;
}
.fleet-mark:hover, .header-action:hover { background: var(--accent); color: var(--foreground); }
.fleet-home-mark { display: none; }
.fleet-tree-toggle[aria-expanded="true"] { background: var(--accent); color: var(--foreground); }
.tree-menu-backdrop {
  position: fixed;
  z-index: 15;
  inset: calc(3.75rem + env(safe-area-inset-top)) 0 0;
  border: 0;
  background: light-dark(#0000002e, #00000080);
  cursor: default;
}
.host-switcher {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: .3rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding: 0 .1rem;
  scrollbar-width: none;
}
.host-switcher::-webkit-scrollbar { display: none; }
.instance-strip { display: none; min-width: 0; }
.host-tree { display: contents; }
.tree-children {
  display: grid;
  min-height: 0;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows .18s cubic-bezier(.2, .8, .2, 1), opacity .14s ease;
}
.tree-children[data-expanded="true"] { grid-template-rows: 1fr; opacity: 1; }
.tree-children-inner { min-height: 0; overflow: hidden; }
.tree-chevron, .tree-pane-dot, .tree-hint { flex: none; }
.tree-chevron { display: none; width: var(--tree-indicator-size); height: var(--tree-indicator-size); overflow: visible; color: var(--muted-foreground); transform-origin: 50% 50%; transition: transform .16s cubic-bezier(.2, .8, .2, 1); }
.tree-row[aria-expanded="true"] > .tree-chevron { transform: rotate(90deg); }
.tree-label { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-hint { max-width: 5.5rem; overflow: hidden; color: var(--muted-foreground); font-size: .62rem; text-overflow: ellipsis; white-space: nowrap; }
.tree-pane-dot { width: var(--tree-indicator-size); height: var(--tree-indicator-size); border-radius: 999px; background: var(--tree-pane-color); box-shadow: 0 0 0 2px color-mix(in oklch, var(--tree-pane-color) 16%, transparent); }
.tree-row-wrap { position: relative; min-width: 0; }
.tree-inline-action { display: none; }
.desktop-fallback-entry { display: none; }
.host-rail-footer, .tree-action-status, .fleet-settings, .tree-rename { display: none; }
.fleet-shortcuts { display: none; }
.connecting { padding: 0 .6rem; color: var(--muted-foreground); font-size: .8rem; }
.instance-tab {
  display: flex;
  height: 2.5rem;
  max-width: 11rem;
  flex: none;
  align-items: center;
  gap: .45rem;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  padding: 0 .8rem;
  color: var(--muted-foreground);
  cursor: pointer;
}
.instance-tab:hover { background: color-mix(in oklch, var(--accent) 60%, transparent); color: var(--foreground); }
.instance-tab[aria-selected="true"] { border-color: var(--border); background: var(--accent); color: var(--foreground); }
.instance-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .8rem; font-weight: 700; }
.status-dot {
  width: .5rem;
  height: .5rem;
  flex: none;
  border-radius: 999px;
  background: var(--status-down);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--status-down) 18%, transparent);
}
.instance-tab[data-health="online"] .status-dot {
  background: var(--status-online);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--status-online) 18%, transparent);
}
.header-action {
  position: relative;
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  flex: none;
  place-items: center;
  border: 0;
  border-radius: calc(var(--radius) - 2px);
  background: transparent;
  color: var(--muted-foreground);
  font-size: 1.25rem;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
}
.header-icon { width: 1.15rem; height: 1.15rem; flex: none; }
.agent-menu-toggle {
  width: auto;
  min-width: 3.35rem;
  grid-template-columns: auto auto;
  gap: .35rem;
  padding: 0 .55rem;
}
.agent-menu-toggle[aria-expanded="true"] { background: var(--accent); color: var(--foreground); }
.agent-menu-icon { color: var(--status-working); }
.agent-menu-count {
  min-width: 1ch;
  color: currentColor;
  font-size: .76rem;
  font-weight: 800;
  line-height: 1;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.agent-menu {
  position: absolute;
  z-index: 30;
  top: calc(3.75rem + env(safe-area-inset-top));
  right: 0;
  left: 0;
  display: flex;
  max-height: min(calc(100dvh - 4.5rem - env(safe-area-inset-top)), 42rem);
  flex-direction: column;
  border-bottom: 1px solid var(--border);
  background: color-mix(in oklch, var(--background) 97%, transparent);
  box-shadow: 0 22px 48px light-dark(#00000024, #000000a0);
  backdrop-filter: blur(18px);
}
.rail-resizer { display: none; }
.agent-menu-heading {
  display: flex;
  flex: none;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--border);
  padding: .85rem 1rem .75rem;
}
.agent-menu-heading h1 { margin: .1rem 0 0; font-size: 1rem; letter-spacing: -.02em; }
.agent-menu-eyebrow { margin: 0; color: var(--muted-foreground); font-size: .62rem; font-weight: 800; letter-spacing: .16em; }
.agent-refresh-state { color: var(--muted-foreground); font-size: .68rem; font-variant-numeric: tabular-nums; }
.agent-sections { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: .85rem .75rem 1.25rem; }
.agent-empty { margin: 0; padding: 2.5rem 1rem; color: var(--muted-foreground); font-size: .82rem; text-align: center; }
.agent-section + .agent-section { margin-top: 1.15rem; }
.agent-section-heading {
  display: flex;
  align-items: center;
  gap: .45rem;
  margin: 0 0 .45rem;
  padding: 0 .25rem;
  color: var(--muted-foreground);
  font-size: .68rem;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.agent-section-heading[data-section="needs"], .agent-section-heading[data-section="offline"] { color: var(--status-blocked); }
.section-dot { width: .45rem; height: .45rem; border-radius: 999px; background: var(--section-color); }
.section-count { margin-left: auto; font-variant-numeric: tabular-nums; }
.agent-card-list { display: flex; flex-direction: column; }
.agent-section[data-attention="true"] .agent-card-list, .agent-section[data-section="offline"] .agent-card-list { gap: .5rem; }
.agent-section:not([data-attention="true"]):not([data-section="offline"]) .agent-card + .agent-card { border-top: 1px solid color-mix(in oklch, var(--border) 65%, transparent); }
.agent-card {
  position: relative;
  width: 100%;
  min-width: 0;
  background: transparent;
  transition: background .15s ease;
}
.agent-card-main {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: .7rem;
  border: 0;
  border-radius: inherit;
  background: transparent;
  padding: .65rem 0 .65rem .7rem;
  color: var(--foreground);
  text-align: left;
  cursor: pointer;
  transition: background .15s ease, transform .08s ease;
}
.agent-card-main:hover { background: color-mix(in oklch, var(--muted) 65%, transparent); }
.agent-card-main:active { transform: scale(.99); }
.agent-card-tools {
  position: absolute;
  z-index: 2;
  top: .45rem;
  right: .5rem;
  display: flex;
  align-items: center;
  gap: .3rem;
}
.agent-favorite {
  display: grid;
  width: 1.9rem;
  height: 1.9rem;
  place-items: center;
  border: 0;
  border-radius: calc(var(--radius) - 3px);
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
}
.agent-favorite:hover, .agent-favorite:focus-visible { background: var(--accent); color: var(--foreground); }
.agent-favorite[aria-pressed="true"] { color: var(--status-working); }
.agent-favorite[aria-pressed="true"] .agent-favorite-icon { fill: currentColor; }
.agent-favorite-icon { width: .95rem; height: .95rem; fill: none; }
.agent-section[data-attention="true"] .agent-card {
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) + 2px);
  background: var(--card);
  box-shadow: 0 1px 2px light-dark(#00000012, #00000050);
}
.agent-section[data-section="needs"] .agent-card {
  border-color: color-mix(in oklch, var(--status-blocked) 40%, var(--border));
  background: color-mix(in oklch, var(--status-blocked) 5%, var(--card));
}
.agent-section[data-section="offline"] .agent-card {
  border: 1px dashed color-mix(in oklch, var(--status-blocked) 38%, var(--border));
  border-radius: calc(var(--radius) + 2px);
  background: color-mix(in oklch, var(--muted) 55%, var(--card));
}
.agent-avatar {
  position: relative;
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 22%;
  background: var(--muted);
  color: var(--foreground);
  font-size: .62rem;
  font-weight: 800;
  letter-spacing: -.02em;
  text-transform: uppercase;
}
.agent-avatar[data-brand="claude"] { border-color: #d97757; background: #d97757; color: #fff; }
.agent-avatar[data-brand="codex"] { border-color: #000; background: #000; color: #fff; }
.agent-avatar[data-brand="opencode"], .agent-avatar[data-brand="pi"] { border-color: #080808; background: #080808; color: #fff; }
.agent-status-dot {
  position: absolute;
  right: -.2rem;
  bottom: -.2rem;
  width: .65rem;
  height: .65rem;
  border: 2px solid var(--card);
  border-radius: 999px;
  background: var(--agent-status-color);
}
.agent-ordinal-badge {
  position: absolute;
  left: -.2rem;
  bottom: -.2rem;
  display: grid;
  width: .65rem;
  height: .65rem;
  place-items: center;
  border: 2px solid var(--card);
  border-radius: 999px;
  background: var(--card);
  color: var(--foreground);
  font-size: .5rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.agent-card[data-live="false"] .agent-avatar, .agent-card[data-live="false"] .agent-status-dot, .agent-card[data-live="false"] .agent-ordinal-badge { opacity: .45; }
.agent-card[data-current-pane="true"] {
  outline: 2px solid var(--ring);
  outline-offset: -2px;
  border-color: var(--ring);
}
.agent-card-copy { min-width: 0; flex: 1; }
.agent-title-line, .agent-meta-line { display: flex; min-width: 0; align-items: baseline; gap: .3rem; }
.agent-project { max-width: 45%; overflow: hidden; color: var(--muted-foreground); text-overflow: ellipsis; white-space: nowrap; }
.agent-title-line:not([data-has-tab="true"]) .agent-project { max-width: none; flex: 1; }
.agent-separator { flex: none; color: color-mix(in oklch, var(--muted-foreground) 60%, transparent); }
.agent-tab { min-width: 0; flex: 1; overflow: hidden; font-size: .88rem; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.agent-meta-line { margin-top: .14rem; color: var(--muted-foreground); font-size: .69rem; }
.agent-secondary { min-width: 0; flex: 1; overflow: hidden; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }
.host-chip, .offline-chip {
  flex: none;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: .12rem .38rem;
  font-size: .62rem;
  font-weight: 750;
  line-height: 1.25;
}
.host-chip { max-width: 8.5rem; overflow: hidden; background: var(--accent); color: var(--foreground); text-overflow: ellipsis; white-space: nowrap; }
.offline-chip { border-color: color-mix(in oklch, var(--status-blocked) 35%, var(--border)); color: var(--status-blocked); text-transform: uppercase; }
.agent-age { flex: none; color: var(--muted-foreground); font-size: .66rem; font-variant-numeric: tabular-nums; }
.shortcut-toast {
  position: fixed;
  z-index: 30;
  bottom: max(1rem, env(safe-area-inset-bottom));
  left: 50%;
  max-width: min(32rem, calc(100vw - 2rem));
  visibility: hidden;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in oklch, var(--card) 94%, transparent);
  padding: .42rem .72rem;
  box-shadow: 0 8px 24px light-dark(#00000018, #00000070);
  color: var(--foreground);
  font-size: .7rem;
  font-weight: 700;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, .35rem);
  transition: opacity .2s ease, transform .2s ease, visibility 0s linear .2s;
  backdrop-filter: blur(12px);
}
.shortcut-toast[data-visible="true"] { visibility: visible; opacity: 1; transform: translate(-50%, 0); transition-delay: 0s; }
.frame-stage { position: relative; display: flex; min-height: 0; flex: 1; overflow: hidden; background: var(--background); }
.node-frame { display: block; width: 100%; height: 100%; border: 0; background: var(--background); }
.frame-loading { position: absolute; inset: 0; z-index: 4; display: grid; place-content: center; justify-items: center; gap: .8rem; background: var(--background); color: var(--muted-foreground); font-size: .8rem; }
.loading-mark, .empty-mark { display: grid; width: 3rem; height: 3rem; place-items: center; border: 1px solid var(--border); border-radius: 1rem; background: var(--card); color: var(--foreground); font-size: 1.1rem; font-weight: 900; animation: pulse 1.35s ease-in-out infinite; }
.node-notice { position: absolute; z-index: 6; top: .75rem; right: .75rem; left: .75rem; display: flex; min-height: 2.75rem; align-items: center; gap: .55rem; border: 1px solid color-mix(in oklch, var(--status-down) 35%, var(--border)); border-radius: var(--radius); background: color-mix(in oklch, var(--card) 94%, transparent); padding: .45rem .55rem; box-shadow: 0 12px 30px light-dark(#00000014, #00000070); backdrop-filter: blur(12px); }
.node-notice .status-dot { width: .55rem; height: .55rem; }
.notice-text { min-width: 0; flex: 1; overflow: hidden; color: var(--muted-foreground); font-size: .75rem; text-overflow: ellipsis; white-space: nowrap; }
.notice-action, .primary-action { min-height: 2rem; border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px); background: var(--accent); padding: 0 .75rem; color: var(--foreground); font-weight: 700; cursor: pointer; }
.empty-state { margin: auto; display: grid; max-width: 20rem; justify-items: center; padding: 2rem; text-align: center; }
.empty-state .empty-mark { animation: none; }
.empty-state h1 { margin: 1rem 0 .4rem; font-size: 1.15rem; }
.empty-state p { margin: 0 0 1.25rem; color: var(--muted-foreground); font-size: .85rem; line-height: 1.5; }
.primary-action { min-height: 2.75rem; padding: 0 1rem; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
[hidden] { display: none !important; }
@keyframes pulse { 50% { opacity: .45; transform: scale(.96); } }
@media (max-width: 1199px) {
.instance-strip {
  position: fixed;
  z-index: 25;
  top: calc(3.75rem + env(safe-area-inset-top));
  bottom: calc(3.35rem + env(safe-area-inset-bottom));
  left: 0;
  display: block;
  width: min(22rem, calc(100vw - 3rem));
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  border-right: 1px solid var(--border);
  background: var(--background);
  padding: .65rem .55rem;
  box-shadow: 18px 0 42px light-dark(#00000024, #000000a0);
  opacity: 0;
  pointer-events: none;
  transform: translateX(calc(-100% - 1rem));
  visibility: hidden;
  transition: transform .2s cubic-bezier(.2, .8, .2, 1), opacity .16s ease, visibility 0s linear .2s;
}
.fleet-shell[data-tree-open="true"] .instance-strip { opacity: 1; pointer-events: auto; transform: translateX(0); visibility: visible; transition-delay: 0s; }
.fleet-shell[data-tree-open="true"] .host-tree { display: block; }
.fleet-shell[data-tree-open="true"] .tree-chevron { display: block; }
.fleet-shell[data-tree-open="true"] .tree-row {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 2.15rem;
  align-items: center;
  gap: .4rem;
  border: 0;
  border-radius: calc(var(--radius) - 3px);
  background: transparent;
  padding-right: .5rem;
  color: var(--muted-foreground);
  font-size: .76rem;
  text-align: left;
  cursor: pointer;
}
.fleet-shell[data-tree-open="true"] .tree-row:hover { background: color-mix(in oklch, var(--accent) 60%, transparent); color: var(--foreground); }
.fleet-shell[data-tree-open="true"] .tree-row[aria-selected="true"] { background: var(--accent); color: var(--fleet-selected-foreground); }
.fleet-shell[data-tree-open="true"] .tree-row[data-stale="true"] { opacity: .58; }
.fleet-shell[data-tree-open="true"] .tree-row[data-disabled="true"] { cursor: default; }
.fleet-shell[data-tree-open="true"] .tree-row-level-2 { padding-left: 1.25rem; }
.fleet-shell[data-tree-open="true"] .tree-row-level-3 { padding-left: 2.15rem; }
.fleet-shell[data-tree-open="true"] .tree-row-level-4 { padding-left: 3.05rem; }
.fleet-shell[data-tree-open="true"] .tree-row-wrap > .tree-row { padding-right: 2.2rem; }
.fleet-shell[data-tree-open="true"] .tree-inline-action {
  position: absolute;
  top: 50%;
  right: .3rem;
  display: grid;
  width: 1.65rem;
  height: 1.65rem;
  place-items: center;
  transform: translateY(-50%);
  border: 0;
  border-radius: calc(var(--radius) - 4px);
  background: color-mix(in oklch, var(--accent) 45%, transparent);
  color: var(--foreground);
  font-size: 1.05rem;
  line-height: 1;
  cursor: pointer;
  opacity: .82;
}
.fleet-shell[data-tree-open="true"] .tree-inline-action:hover,
.fleet-shell[data-tree-open="true"] .tree-inline-action:focus-visible { background: var(--accent); opacity: 1; }
.fleet-shell[data-tree-open="true"] .instance-strip .instance-tab {
  width: 100%;
  max-width: none;
  justify-content: flex-start;
  border-radius: calc(var(--radius) - 1px);
  padding: 0 .5rem;
}
.host-rail-footer {
  position: fixed;
  z-index: 26;
  bottom: 0;
  left: 0;
  display: flex;
  width: min(22rem, calc(100vw - 3rem));
  min-height: calc(3.35rem + env(safe-area-inset-bottom));
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--border);
  border-right: 1px solid var(--border);
  background: var(--muted);
  padding: .45rem .65rem calc(.45rem + env(safe-area-inset-bottom));
  box-shadow: 18px 0 42px light-dark(#00000024, #000000a0);
  opacity: 0;
  pointer-events: none;
  transform: translateX(calc(-100% - 1rem));
  visibility: hidden;
  transition: transform .2s cubic-bezier(.2, .8, .2, 1), opacity .16s ease, visibility 0s linear .2s;
}
.fleet-shell[data-tree-open="true"] .host-rail-footer { opacity: 1; pointer-events: auto; transform: translateX(0); visibility: visible; transition-delay: 0s; }
.host-rail-version { color: var(--muted-foreground); font-size: .66rem; font-variant-numeric: tabular-nums; }
.host-rail-settings {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 0;
  border-radius: calc(var(--radius) - 3px);
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
}
.host-rail-settings:hover,
.host-rail-settings[aria-expanded="true"] { background: var(--accent); color: var(--foreground); }
.fleet-settings-anchor { position: relative; }
.fleet-settings {
  position: absolute;
  z-index: 60;
  right: 0;
  bottom: calc(100% + .5rem);
  display: block;
  width: min(19rem, calc(100vw - 4rem));
  min-width: 10rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
  padding: .8rem;
  box-shadow: 0 16px 42px light-dark(#00000020, #000000a0);
}
.fleet-settings-heading { display: flex; align-items: baseline; justify-content: space-between; gap: .5rem; font-size: .78rem; }
.fleet-settings-heading span { color: var(--muted-foreground); font-size: .62rem; }
.fleet-setting-row { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-top: .85rem; }
.fleet-setting-row > span { display: grid; min-width: 0; gap: .15rem; }
.fleet-setting-row strong { font-size: .72rem; }
.fleet-setting-row small { color: var(--muted-foreground); font-size: .62rem; line-height: 1.35; }
.fleet-setting-row select { min-width: 3.5rem; border: 1px solid var(--border); border-radius: calc(var(--radius) - 3px); background: var(--background); padding: .35rem .45rem; color: var(--foreground); }
.fleet-settings-foot { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin-top: .75rem; color: var(--muted-foreground); font-size: .62rem; }
.fleet-settings-foot button { border: 0; background: transparent; padding: .25rem; color: var(--muted-foreground); font-size: .64rem; cursor: pointer; }
.fleet-settings-foot button:hover { color: var(--foreground); }
.fleet-shell[data-tree-open="true"] .tree-action-status {
  position: fixed;
  z-index: 27;
  right: calc(100vw - min(22rem, calc(100vw - 3rem)) + .55rem);
  bottom: calc(3.85rem + env(safe-area-inset-bottom));
  left: .55rem;
  display: block;
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 2px);
  background: var(--card);
  padding: .45rem .55rem;
  color: var(--muted-foreground);
  font-size: .67rem;
  line-height: 1.35;
  box-shadow: 0 12px 30px light-dark(#00000014, #00000070);
}
.fleet-shell[data-tree-open="true"] .tree-action-status[data-kind="error"] { border-color: color-mix(in oklch, var(--status-blocked) 38%, var(--border)); color: var(--status-blocked); }
}
@media (max-width: 640px) {
  .fleet-shell { box-shadow: none; }
  .fleet-header { padding-right: .25rem; padding-left: .25rem; }
  .fleet-mark, .header-action { width: 2.5rem; }
  .instance-tab { max-width: 8.5rem; padding: 0 .65rem; }
  .host-chip { max-width: 6.5rem; }
}
@media (min-width: 1200px) {
  .fleet-shell {
    display: grid;
    grid-template: minmax(0, 1fr) / var(--fleet-host-rail-width) minmax(40rem, 1fr) var(--fleet-agent-rail-width);
    grid-template-areas: "hosts frame agents";
    box-shadow: none;
  }
  .fleet-header {
    position: relative;
    grid-area: hosts;
    min-height: 0;
    flex-direction: column;
    align-items: stretch;
    gap: .35rem;
    border-right: 1px solid var(--border);
    border-bottom: 0;
    padding: 1rem .75rem 0;
  }
  .fleet-tree-toggle { display: none; }
  .fleet-home-mark { display: grid; align-self: flex-start; }
  .host-switcher { display: none; }
  .tree-menu-backdrop { display: none !important; }
  .instance-strip {
    display: flex;
    width: 100%;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    align-items: stretch;
    gap: .2rem;
    overflow-x: hidden;
    overflow-y: auto;
    padding-bottom: .5rem;
  }
  .host-tree { display: block; }
  .tree-chevron { display: block; }
  .tree-row {
    display: flex;
    width: 100%;
    min-width: 0;
    height: 1.85rem;
    align-items: center;
    gap: .4rem;
    border: 0;
    border-radius: calc(var(--radius) - 3px);
    background: transparent;
    padding-right: .5rem;
    color: var(--muted-foreground);
    font-size: .74rem;
    text-align: left;
    cursor: pointer;
  }
  .tree-row:hover { background: color-mix(in oklch, var(--accent) 60%, transparent); color: var(--foreground); }
  .tree-row[aria-selected="true"] { background: var(--accent); color: var(--fleet-selected-foreground); }
  .tree-row[data-stale="true"] { opacity: .58; }
  .tree-row[data-disabled="true"] { cursor: default; }
  .tree-row-level-2 { padding-left: 1.25rem; }
  .tree-row-level-3 { padding-left: 2.15rem; }
  .tree-row-level-4 { padding-left: 3.05rem; }
  .tree-row-wrap > .tree-row { padding-right: 2rem; }
  .tree-inline-action {
    position: absolute;
    top: 50%;
    right: .22rem;
    display: grid;
    width: 1.5rem;
    height: 1.5rem;
    place-items: center;
    transform: translateY(-50%);
    border: 0;
    border-radius: calc(var(--radius) - 4px);
    background: transparent;
    color: var(--muted-foreground);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
  }
  .tree-row-wrap:hover .tree-inline-action, .tree-inline-action:focus-visible { opacity: 1; }
  .tree-inline-action:hover { background: var(--accent); color: var(--foreground); }
  .instance-tab {
    width: 100%;
    max-width: none;
    justify-content: flex-start;
    border-radius: calc(var(--radius) - 1px);
    padding: 0 .5rem;
  }
  .agent-menu-toggle { display: none; }
  #open-node { position: absolute; top: 1rem; right: .75rem; }
  .host-rail-footer {
    position: relative;
    display: flex;
    min-height: 2.75rem;
    flex: none;
    align-items: center;
    justify-content: space-between;
    margin: 0 -.75rem;
    border-top: 1px solid var(--border);
    padding: .45rem .65rem;
    background: var(--muted);
  }
  .host-rail-version { color: var(--muted-foreground); font-size: .66rem; font-variant-numeric: tabular-nums; }
  .desktop-fallback-entry {
    min-width: 0;
    align-items: center;
    border-radius: calc(var(--radius) - 4px);
    padding: .3rem .4rem;
    color: var(--muted-foreground);
    font-size: .63rem;
    text-decoration: none;
    white-space: nowrap;
  }
  .desktop-fallback-entry:hover, .desktop-fallback-entry:focus-visible { background: var(--accent); color: var(--foreground); }
  .host-rail-settings {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border: 0;
    border-radius: calc(var(--radius) - 3px);
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
  }
  .host-rail-settings:hover, .host-rail-settings[aria-expanded="true"] { background: var(--accent); color: var(--foreground); }
  .fleet-settings-anchor { position: relative; }
  .fleet-settings {
    position: absolute;
    z-index: 60;
    right: 0;
    bottom: calc(100% + .5rem);
    display: block;
    width: min(19rem, calc(var(--fleet-host-rail-width) - 1rem));
    min-width: 10rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
    padding: .8rem;
    box-shadow: 0 16px 42px light-dark(#00000020, #000000a0);
  }
  .fleet-settings-heading { display: flex; align-items: baseline; justify-content: space-between; gap: .5rem; font-size: .78rem; }
  .fleet-settings-heading span { color: var(--muted-foreground); font-size: .62rem; }
  .fleet-setting-row { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-top: .85rem; }
  .fleet-setting-row > span { display: grid; min-width: 0; gap: .15rem; }
  .fleet-setting-row strong { font-size: .72rem; }
  .fleet-setting-row small { color: var(--muted-foreground); font-size: .62rem; line-height: 1.35; }
  .fleet-setting-row select { min-width: 3.5rem; border: 1px solid var(--border); border-radius: calc(var(--radius) - 3px); background: var(--background); padding: .35rem .45rem; color: var(--foreground); }
  .fleet-settings-foot { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin-top: .75rem; color: var(--muted-foreground); font-size: .62rem; }
  .fleet-settings-foot button { border: 0; background: transparent; padding: .25rem; color: var(--muted-foreground); font-size: .64rem; cursor: pointer; }
  .fleet-settings-foot button:hover { color: var(--foreground); }
  .fleet-shortcuts { display: block; margin-top: .85rem; border-top: 1px solid var(--border); padding-top: .7rem; }
  .fleet-shortcuts h2 { margin: 0 0 .45rem; font-size: .72rem; }
  .fleet-shortcuts ul { display: grid; gap: .28rem; margin: 0; padding: 0; list-style: none; }
  .fleet-shortcuts li { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: .65rem; color: var(--muted-foreground); font-size: .65rem; }
  .fleet-shortcuts kbd { flex: none; border: 1px solid var(--border); border-bottom-width: 2px; border-radius: calc(var(--radius) - 4px); background: var(--background); padding: .13rem .32rem; color: var(--foreground); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .6rem; line-height: 1.2; }
  .agent-title-line { padding-right: 2.4rem; }
  .agent-meta-line { padding-right: .75rem; }
  .tree-action-status {
    display: block;
    flex: none;
    margin: .15rem 0 .35rem;
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) - 2px);
    background: var(--card);
    padding: .45rem .55rem;
    color: var(--muted-foreground);
    font-size: .67rem;
    line-height: 1.35;
  }
  .tree-action-status[data-kind="error"] { border-color: color-mix(in oklch, var(--status-blocked) 38%, var(--border)); color: var(--status-blocked); }
  .tree-rename {
    position: fixed;
    z-index: 70;
    left: .65rem;
    display: block;
    width: min(18rem, calc(var(--fleet-host-rail-width) - 1.3rem));
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
    padding: .7rem;
    box-shadow: 0 16px 42px light-dark(#00000020, #000000a0);
  }
  .tree-rename form { display: grid; gap: .55rem; }
  .tree-rename label { font-size: .72rem; font-weight: 750; }
  .tree-rename input { width: 100%; min-width: 0; border: 1px solid var(--border); border-radius: calc(var(--radius) - 3px); background: var(--background); padding: .48rem .55rem; color: var(--foreground); }
  .tree-rename-error { margin: 0; color: var(--status-blocked); font-size: .64rem; line-height: 1.35; }
  .tree-rename-actions { display: flex; justify-content: flex-end; gap: .4rem; }
  .tree-rename-actions button { min-height: 1.85rem; border: 1px solid var(--border); border-radius: calc(var(--radius) - 3px); background: var(--background); padding: 0 .65rem; color: var(--foreground); font-size: .68rem; cursor: pointer; }
  #tree-rename-save { background: var(--accent); font-weight: 700; }
  .tree-rename-actions button:disabled { cursor: wait; opacity: .55; }
  .agent-menu {
    position: relative;
    z-index: 10;
    grid-area: agents;
    inset: auto;
    display: flex;
    max-height: none;
    min-width: 0;
    border-bottom: 0;
    border-left: 1px solid var(--border);
    background: var(--background);
    box-shadow: none;
    backdrop-filter: none;
  }
  .agent-menu-heading {
    order: 2;
    align-items: center;
    justify-content: flex-end;
    border-top: 1px solid var(--border);
    border-bottom: 0;
    padding: .6rem .75rem;
  }
  .agent-menu-heading > div { display: none; }
  .agent-refresh-state { margin-left: auto; }
  .agent-sections { order: 1; flex: 1; }
  .frame-stage { grid-area: frame; }
  .rail-resizer {
    position: absolute;
    z-index: 40;
    top: 0;
    bottom: 0;
    display: block;
    width: .7rem;
    border: 0;
    background: transparent;
    cursor: col-resize;
    touch-action: none;
  }
  .rail-resizer::after {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
    background: var(--border);
    content: "";
    transition: width .12s ease, background .12s ease;
  }
  .rail-resizer:hover::after, .rail-resizer:focus-visible::after {
    width: 2px;
    background: var(--ring);
  }
  .host-rail-resizer { left: var(--fleet-host-rail-width); transform: translateX(-50%); }
  .agent-rail-resizer { right: var(--fleet-agent-rail-width); transform: translateX(50%); }
  .fleet-shell[data-resizing="true"] { cursor: col-resize; user-select: none; }
  .fleet-shell[data-resizing="true"] .node-frame { pointer-events: none; }
}
@media (min-width: 1200px) and (hover: hover) and (pointer: fine) {
  .desktop-fallback-entry { display: inline-flex; }
}
@media (prefers-reduced-motion: reduce) {
  .loading-mark { animation: none; }
  .agent-card, .agent-card-main { transition: none; }
  .instance-strip, .host-rail-footer, .tree-children, .tree-chevron { transition: none !important; }
}
`;

export const FLEET_JS = `
const STORAGE_KEY='herdr-web-remote:selected-instance';
const RAIL_STORAGE_KEY='herdr-web-remote:fleet-rail-widths:v1';
const CACHE_STORAGE_KEY='herdr-web-remote:fleet-iframe-cache:v1';
const AGENT_FAVORITES_STORAGE_KEY='herdr-web-remote:fleet-agent-favorites:v1';
const AGENT_FAVORITES_MAX=${FLEET_AGENT_FAVORITES_MAX};
const SHORTCUT_REGISTRY=${JSON.stringify(FLEET_SHORTCUTS)};
const ROUTE_MESSAGE='herdr-web-remote:route';
const FRAME_ACTIVITY_MESSAGE='herdr-web-remote:activity';
const FRAME_ACTIVITY_VERSION=1;
const ACTION_PROBE_MESSAGE='herdr-web-remote:action-probe';
const ACTION_READY_MESSAGE='herdr-web-remote:action-ready';
const ACTION_REQUEST_MESSAGE='herdr-web-remote:action-request';
const ACTION_RESULT_MESSAGE='herdr-web-remote:action-result';
const ACTION_VERSION=1;
const ACTION_PROBE_TIMEOUT_MS=8000;
const ACTION_RESULT_TIMEOUT_MS=25000;
const SHORTCUT_CONFIG_MESSAGE='herdr-web-remote:shortcut-config';
const SHORTCUT_INTENT_MESSAGE='herdr-web-remote:shortcut-intent';
const SHORTCUT_COMMAND_MESSAGE='herdr-web-remote:shortcut-command';
const SHORTCUT_RESULT_MESSAGE='herdr-web-remote:shortcut-result';
const SHORTCUT_VERSION=1;
const SHORTCUT_COMMAND_TIMEOUT_MS=18000;
const DEFAULT_REFRESH_MS=5000;
const MIN_REFRESH_TIMER_MS=250;
const FRAME_CACHE_QUIET_MS=1800000;
const DESKTOP_MEDIA='(min-width: 1200px)';
const FALLBACK_DESKTOP_MEDIA='(min-width: 1200px) and (hover: hover) and (pointer: fine)';
const RAIL_WIDTHS={leftDefault:${FLEET_RAIL_WIDTHS.leftDefault},leftMin:${FLEET_RAIL_WIDTHS.leftMin},leftMax:${FLEET_RAIL_WIDTHS.leftMax},rightDefault:${FLEET_RAIL_WIDTHS.rightDefault},rightMin:${FLEET_RAIL_WIDTHS.rightMin},rightMax:${FLEET_RAIL_WIDTHS.rightMax},centreMin:${FLEET_RAIL_WIDTHS.centreMin}};
const shell=document.querySelector('.fleet-shell');
const hostSwitcher=document.querySelector('#host-switcher');
const instances=document.querySelector('#instances');
const treeMenuToggle=document.querySelector('#tree-menu-toggle');
const treeMenuBackdrop=document.querySelector('#tree-menu-backdrop');
const frameStage=document.querySelector('#frame-stage');
const loading=document.querySelector('#frame-loading');
const notice=document.querySelector('#node-notice');
const noticeText=document.querySelector('#notice-text');
const openNode=document.querySelector('#open-node');
const empty=document.querySelector('#empty-state');
const emptyTitle=document.querySelector('#empty-title');
const emptyCopy=document.querySelector('#empty-copy');
const fleetStatus=document.querySelector('#fleet-status');
const agentMenu=document.querySelector('#agent-menu');
const agentMenuToggle=document.querySelector('#agent-menu-toggle');
const agentMenuCount=document.querySelector('#agent-menu-count');
const agentSections=document.querySelector('#agent-sections');
const agentRefreshState=document.querySelector('#agent-refresh-state');
const hostRailFooter=document.querySelector('#host-rail-footer');
const settingsAnchor=document.querySelector('.fleet-settings-anchor');
const hostRailResizer=document.querySelector('#host-rail-resizer');
const agentRailResizer=document.querySelector('#agent-rail-resizer');
const settingsToggle=document.querySelector('#fleet-settings-toggle');
const settingsPopover=document.querySelector('#fleet-settings');
const cacheSizeSelect=document.querySelector('#iframe-cache-size');
const cacheReset=document.querySelector('#iframe-cache-reset');
const treeActionStatus=document.querySelector('#tree-action-status');
const shortcutToast=document.querySelector('#shortcut-toast');
const renamePopover=document.querySelector('#tree-rename');
const renameForm=document.querySelector('#tree-rename-form');
const renameTitle=document.querySelector('#tree-rename-title');
const renameInput=document.querySelector('#tree-rename-input');
const renameError=document.querySelector('#tree-rename-error');
const renameCancel=document.querySelector('#tree-rename-cancel');
const renameSave=document.querySelector('#tree-rename-save');
const desktopMedia=matchMedia(DESKTOP_MEDIA);
const fallbackDesktopMedia=matchMedia(FALLBACK_DESKTOP_MEDIA);
const configuredCacheSize=Number(shell.dataset.iframeCacheSize);
const defaultCacheSize=Number.isSafeInteger(configuredCacheSize)&&configuredCacheSize>=1&&configuredCacheSize<=10?configuredCacheSize:1;
let iframeCacheSize=readIframeCachePreference();
let agentFavorites=readAgentFavorites();
const frameRegistry=new Map();
const expandedTreeKeys=new Set();
const initializedHostKeys=new Set();
let nodes=[];
let selectedId=null;
let refreshing=false;
let queuedManualRefresh=false;
let refreshTimer=null;
let quietTimer=null;
let lastFrameVisitAt=Date.now();
let desktopMode=desktopMedia.matches;
let treeOpen=false;
let preferredRailWidths=readRailWidthPreferences();
let appliedRailWidths={left:RAIL_WIDTHS.leftDefault,right:RAIL_WIDTHS.rightDefault};
let railDrag=null;
let pendingAction=null;
let renameTarget=null;
let actionStatusTimer=null;
let shortcutToastTimer=null;
let pendingFavoriteFocusKey=null;
let paneShortcutTargets=[];
let agentShortcutTargets=[];
let shortcutGeneration=0;
let pendingShortcutCommand=null;
const recentShortcutIntents=new Set();

const healthLabel=(health)=>({online:'Online','herdr-down':'Herdr unavailable','bridge-down':'Collie unavailable','transport-down':'Transport unavailable'}[health]||'Unavailable');
const statusLabel=(status)=>({blocked:'needs you',working:'working',done:'done',idle:'idle',unknown:'unknown'}[status]||'unknown');
const statusColor=(status)=>'var(--status-'+(['blocked','working','done','idle','unknown'].includes(status)?status:'unknown')+')';
const remembered=()=>{try{return localStorage.getItem(STORAGE_KEY)}catch{return null}};
const remember=(id)=>{try{localStorage.setItem(STORAGE_KEY,id)}catch{}};
const requested=()=>new URL(location.href).searchParams.get('instance');
const nodeOrigin=(node)=>new URL('https://'+node.publicHost+'/').origin;
const selectedNode=()=>nodes.find((node)=>node.id===selectedId)||null;
const fallbackHref=(node)=>{
 if(!node||typeof node.fallbackUrl!=='string')return null;
 try{const url=new URL(node.fallbackUrl);return url.protocol==='https:'&&url.origin===location.origin&&!url.username&&!url.password&&!url.port&&url.pathname==='/ttyd/'+node.id+'/'&&!url.search&&!url.hash?url.href:null}catch{return null}
};
const announce=(message)=>{fleetStatus.textContent=message};
const validPane=(value)=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)?value:null;
const validSession=(value)=>{
 if(typeof value!=='string')return null;
 const trimmed=value.trim();
 return trimmed&&trimmed.length<=128&&!/[\\u0000-\\u001f\\u007f]/.test(trimmed)?trimmed:null;
};
const element=(tag,className,text)=>{const value=document.createElement(tag);if(className)value.className=className;if(text!==undefined)value.textContent=String(text);return value};
const initials=(value)=>String(value||'').trim().split(/[\\s._-]+/).filter(Boolean).slice(0,2).map((part)=>part[0]).join('').toUpperCase()||'?';
const brand=(value)=>{const key=String(value||'').trim().toLowerCase();if(key.startsWith('claude'))return'claude';if(key.startsWith('codex'))return'codex';if(key.startsWith('opencode'))return'opencode';if(key==='pi'||key.startsWith('pi-')||key.startsWith('pi.'))return'pi';return'unknown'};
const baseName=(value)=>String(value||'').replace(/[\\/\\\\]+$/,'').split(/[\\/\\\\]/).pop()||'';
const shortCwd=(value)=>{const parts=String(value||'').split(/[\\/\\\\]/).filter(Boolean);return parts.length>2?'…/'+parts.slice(-2).join('/'):String(value||'')};
const formatDelay=(ms)=>ms>=3600000?'1h':ms>=60000?Math.round(ms/60000)+'m':Math.round(ms/1000)+'s';
const timeAgo=(at)=>{const seconds=Math.max(0,Math.floor((Date.now()-at)/1000));if(seconds<60)return seconds+'s';const minutes=Math.floor(seconds/60);if(minutes<60)return minutes+'m';const hours=Math.floor(minutes/60);if(hours<24)return hours+'h';return Math.floor(hours/24)+'d'};
const shortcutPaneKey=(nodeId,paneId,session)=>[nodeId,paneId,session||''].join('|');

function matchShortcut(event){
 if(!desktopMedia.matches||event.repeat)return null;
 return SHORTCUT_REGISTRY.find((shortcut)=>shortcut.code===event.code&&shortcut.altKey===event.altKey&&shortcut.ctrlKey===event.ctrlKey&&shortcut.metaKey===event.metaKey&&shortcut.shiftKey===event.shiftKey)||null;
}

function readIframeCachePreference(){
 try{
   const value=JSON.parse(localStorage.getItem(CACHE_STORAGE_KEY)||'null');
   return value&&value.version===1&&Number.isSafeInteger(value.size)&&value.size>=1&&value.size<=10?value.size:defaultCacheSize;
 }catch{return defaultCacheSize}
}

function persistIframeCachePreference(size){
 try{localStorage.setItem(CACHE_STORAGE_KEY,JSON.stringify({version:1,size}))}catch{}
}

function agentFavoriteKey(node,agent){return JSON.stringify([node.id,agent.herdrSession,agent.paneId,agent.agent])}

function validAgentFavoriteKey(value){
 if(typeof value!=='string'||value.length>600)return false;
 try{const parts=JSON.parse(value);return Array.isArray(parts)&&parts.length===4&&parts.every((part)=>typeof part==='string'&&part.length>=1&&part.length<=128&&!/[\u0000-\u001f\u007f]/.test(part))}catch{return false}
}

function readAgentFavorites(){
 try{
   const value=JSON.parse(localStorage.getItem(AGENT_FAVORITES_STORAGE_KEY)||'null');
   if(!value||value.version!==1||!Array.isArray(value.keys)||value.keys.length>AGENT_FAVORITES_MAX||!value.keys.every(validAgentFavoriteKey)||new Set(value.keys).size!==value.keys.length)return new Set();
   return new Set(value.keys);
 }catch{return new Set()}
}

function persistAgentFavorites(){
 try{localStorage.setItem(AGENT_FAVORITES_STORAGE_KEY,JSON.stringify({version:1,keys:[...agentFavorites]}))}catch{}
}

function showTreeActionStatus(message,kind='success'){
 if(actionStatusTimer!==null){clearTimeout(actionStatusTimer);actionStatusTimer=null}
 treeActionStatus.textContent=message;treeActionStatus.dataset.kind=kind;treeActionStatus.hidden=false;announce(message);
 actionStatusTimer=setTimeout(()=>{actionStatusTimer=null;treeActionStatus.hidden=true;delete treeActionStatus.dataset.kind},5000);
}

function showShortcutToast(shortcut){
 if(shortcutToastTimer!==null){clearTimeout(shortcutToastTimer);shortcutToastTimer=null}
 shortcutToast.textContent=shortcut.keyLabel+' · '+shortcut.label;shortcutToast.dataset.visible='true';shortcutToast.setAttribute('aria-hidden','false');
 shortcutToastTimer=setTimeout(()=>{shortcutToastTimer=null;delete shortcutToast.dataset.visible;shortcutToast.setAttribute('aria-hidden','true')},1800);
}

function shrinkFrameCache(){
 while(frameRegistry.size>iframeCacheSize){const candidate=evictionCandidate();if(!candidate)break;releaseFrame(candidate.id)}
}

function setIframeCacheSize(value,{persist=true}={}){
 const size=Number(value);if(!Number.isSafeInteger(size)||size<1||size>10)return false;
 iframeCacheSize=size;cacheSizeSelect.value=String(size);if(persist)persistIframeCachePreference(size);shrinkFrameCache();
 announce('Iframe cache set to '+size+'.');return true;
}

function closeSettings({restoreFocus=false}={}){
 settingsPopover.hidden=true;settingsToggle.setAttribute('aria-expanded','false');if(restoreFocus)settingsToggle.focus();
}

function openSettings(){
 if(!desktopMedia.matches&&!treeOpen)return;closeRename();settingsPopover.hidden=false;settingsToggle.setAttribute('aria-expanded','true');cacheSizeSelect.value=String(iframeCacheSize);cacheSizeSelect.focus();
}

function clampRail(value,minimum,maximum){return Math.min(maximum,Math.max(minimum,Math.round(value)))}

function fitRailWidths(preferred,viewportWidth=innerWidth){
 const viewport=Number.isFinite(viewportWidth)&&viewportWidth>0?Math.floor(viewportWidth):1200;
 let left=clampRail(Number.isFinite(preferred?.left)?preferred.left:RAIL_WIDTHS.leftDefault,RAIL_WIDTHS.leftMin,RAIL_WIDTHS.leftMax);
 let right=clampRail(Number.isFinite(preferred?.right)?preferred.right:RAIL_WIDTHS.rightDefault,RAIL_WIDTHS.rightMin,RAIL_WIDTHS.rightMax);
 const minimumRailTotal=RAIL_WIDTHS.leftMin+RAIL_WIDTHS.rightMin;
 const railBudget=Math.max(minimumRailTotal,viewport-RAIL_WIDTHS.centreMin);
 let overflow=Math.max(0,left+right-railBudget);
 if(overflow>0){
   const leftFlex=left-RAIL_WIDTHS.leftMin;const rightFlex=right-RAIL_WIDTHS.rightMin;const flexTotal=leftFlex+rightFlex;
   const leftReduction=flexTotal>0?Math.min(leftFlex,Math.floor((overflow*leftFlex)/flexTotal)):0;
   left-=leftReduction;overflow-=leftReduction;
   const rightReduction=Math.min(rightFlex,overflow);right-=rightReduction;overflow-=rightReduction;
   left-=Math.min(left-RAIL_WIDTHS.leftMin,overflow);
 }
 return {left,right};
}

function readRailWidthPreferences(){
 try{
   const value=JSON.parse(localStorage.getItem(RAIL_STORAGE_KEY)||'null');
   if(!value||value.version!==1||!Number.isFinite(value.left)||!Number.isFinite(value.right)||value.left<=0||value.right<=0)throw new Error('invalid');
   return {left:value.left,right:value.right};
 }catch{return {left:RAIL_WIDTHS.leftDefault,right:RAIL_WIDTHS.rightDefault}}
}

function persistRailWidthPreferences(){
 try{localStorage.setItem(RAIL_STORAGE_KEY,JSON.stringify({version:1,left:preferredRailWidths.left,right:preferredRailWidths.right}))}catch{}
}

function railMaximum(side,widths=appliedRailWidths,viewportWidth=innerWidth){
 const minimum=side==='left'?RAIL_WIDTHS.leftMin:RAIL_WIDTHS.rightMin;
 const staticMaximum=side==='left'?RAIL_WIDTHS.leftMax:RAIL_WIDTHS.rightMax;
 const other=side==='left'?widths.right:widths.left;
 return Math.max(minimum,Math.min(staticMaximum,Math.floor(viewportWidth)-RAIL_WIDTHS.centreMin-other));
}

function updateRailSeparator(handle,side){
 const minimum=side==='left'?RAIL_WIDTHS.leftMin:RAIL_WIDTHS.rightMin;
 const maximum=railMaximum(side);
 const value=side==='left'?appliedRailWidths.left:appliedRailWidths.right;
 handle.setAttribute('aria-valuemin',String(minimum));handle.setAttribute('aria-valuemax',String(maximum));handle.setAttribute('aria-valuenow',String(value));handle.setAttribute('aria-valuetext',value+' pixels');
}

function renderRailWidths(){
 shell.style.setProperty('--fleet-host-rail-width',appliedRailWidths.left+'px');
 shell.style.setProperty('--fleet-agent-rail-width',appliedRailWidths.right+'px');
 updateRailSeparator(hostRailResizer,'left');updateRailSeparator(agentRailResizer,'right');
}

function applyRailWidthPreferences(){
 if(!desktopMedia.matches){shell.style.removeProperty('--fleet-host-rail-width');shell.style.removeProperty('--fleet-agent-rail-width');return}
 appliedRailWidths=fitRailWidths(preferredRailWidths);renderRailWidths();
}

function setRailWidth(side,requestedWidth,persist=false){
 const minimum=side==='left'?RAIL_WIDTHS.leftMin:RAIL_WIDTHS.rightMin;
 const current=side==='left'?appliedRailWidths.left:appliedRailWidths.right;
 const width=clampRail(Number.isFinite(requestedWidth)?requestedWidth:current,minimum,railMaximum(side));
 appliedRailWidths=side==='left'?{left:width,right:appliedRailWidths.right}:{left:appliedRailWidths.left,right:width};
 preferredRailWidths=side==='left'?{left:width,right:preferredRailWidths.right}:{left:preferredRailWidths.left,right:width};
 renderRailWidths();if(persist)persistRailWidthPreferences();
}

function railWidthFromPointer(side,event){
 const bounds=shell.getBoundingClientRect();return side==='left'?event.clientX-bounds.left:bounds.right-event.clientX;
}

function finishRailDrag(handle,persist){
 if(!railDrag||railDrag.handle!==handle)return;
 if(persist)persistRailWidthPreferences();railDrag=null;delete shell.dataset.resizing;
}

function bindRailResizer(handle,side){
 handle.addEventListener('pointerdown',(event)=>{
   if(!desktopMedia.matches||event.button!==0)return;
   event.preventDefault();railDrag={handle,side,pointerId:event.pointerId};shell.dataset.resizing='true';
   handle.setPointerCapture(event.pointerId);setRailWidth(side,railWidthFromPointer(side,event));
 });
 handle.addEventListener('pointermove',(event)=>{if(railDrag?.handle===handle&&railDrag.pointerId===event.pointerId)setRailWidth(side,railWidthFromPointer(side,event))});
 handle.addEventListener('pointerup',(event)=>{if(railDrag?.handle!==handle||railDrag.pointerId!==event.pointerId)return;setRailWidth(side,railWidthFromPointer(side,event));finishRailDrag(handle,true)});
 handle.addEventListener('pointercancel',()=>finishRailDrag(handle,false));
 handle.addEventListener('lostpointercapture',()=>finishRailDrag(handle,false));
 handle.addEventListener('keydown',(event)=>{
   if(!desktopMedia.matches||(event.key!=='ArrowLeft'&&event.key!=='ArrowRight'))return;
   event.preventDefault();const physicalDelta=(event.key==='ArrowRight'?1:-1)*(event.shiftKey?32:8);const widthDelta=side==='left'?physicalDelta:-physicalDelta;
   setRailWidth(side,(side==='left'?appliedRailWidths.left:appliedRailWidths.right)+widthDelta,true);
 });
}

function requestedRoute(){
 const params=new URL(location.href).searchParams;
 const rawSpace=params.get('space');const rawTab=params.get('tab');const rawPane=params.get('pane');const rawSession=params.get('session');
 const spaceId=validPane(rawSpace);const tabId=validPane(rawTab);const paneId=validPane(rawPane);const session=validSession(rawSession);
 const hasLocation=rawSpace!==null||rawTab!==null;
 const invalid=(rawPane!==null&&!paneId)||(rawSession!==null&&!session)||(hasLocation&&(!paneId||!spaceId||!tabId));
 return {view:paneId?'pane':'home',...(paneId?{paneId}:{}),...(spaceId&&tabId?{spaceId,tabId}:{}),...(session?{session}:{}),invalid};
}

const routeKey=(origin,route)=>origin+'|'+route.view+'|'+(route.paneId||'')+'|'+(route.session||'');

function canonicalPaneRoute(paneId,session,spaceId=null,tabId=null,nodeId=selectedId){
 const route={view:'pane',paneId,...(session?{session}:{})};
 const node=nodes.find((candidate)=>candidate.id===nodeId)||null;
 const match=node&&Array.isArray(node.agentEntries)?node.agentEntries.find((agent)=>agent.paneId===paneId&&(session?(!agent.primarySession&&agent.herdrSession===session):agent.primarySession)):null;
 const matchedSpace=validPane(match&&match.workspaceId);const matchedTab=validPane(match&&match.tabId);
 if(matchedSpace&&matchedTab)return {...route,spaceId:matchedSpace,tabId:matchedTab};
 const safeSpace=validPane(spaceId);const safeTab=validPane(tabId);
 if(safeSpace&&safeTab)return {...route,spaceId:safeSpace,tabId:safeTab};
 if(nodeId===selectedId){const current=requestedRoute();if(current.view==='pane'&&current.paneId===paneId&&(current.session||'')===(session||'')&&current.spaceId&&current.tabId)return {...route,spaceId:current.spaceId,tabId:current.tabId}}
 return route;
}

function frameHref(origin,route){
 const url=new URL('/',origin);
 if(route.view==='pane')url.pathname='/pane/'+encodeURIComponent(route.paneId);
 if(route.session)url.searchParams.set('s',route.session);
 return url.href;
}

function replaceUrl(id,route){
 const url=new URL(location.href);
 url.searchParams.set('instance',id);
 url.searchParams.delete('space');url.searchParams.delete('tab');url.searchParams.delete('pane');url.searchParams.delete('session');
 if(route.view==='pane'){
   if(route.spaceId&&route.tabId){url.searchParams.set('space',route.spaceId);url.searchParams.set('tab',route.tabId)}
   url.searchParams.set('pane',route.paneId);
 }
 if(route.session)url.searchParams.set('session',route.session);
 if(url.href===location.href)return;
 history.replaceState(null,'',url);
}

const activeEntry=()=>selectedId?frameRegistry.get(selectedId)||null:null;

function frameActivityActive(entry){
 return entry.id===selectedId&&!entry.frame.hidden&&!document.hidden&&(desktopMedia.matches||(!treeOpen&&agentMenu.hidden));
}

function postFrameActivity(entry){
 const target=entry.frame.contentWindow;if(!target)return false;
 target.postMessage({type:FRAME_ACTIVITY_MESSAGE,version:FRAME_ACTIVITY_VERSION,active:frameActivityActive(entry)},entry.origin);return true;
}

function shortcutFrameActive(entry){
 return desktopMedia.matches&&!document.hidden&&entry.id===selectedId&&!entry.frame.hidden;
}

function postFrameShortcutConfig(entry){
 const target=entry.frame.contentWindow;if(!target)return false;
 shortcutGeneration=shortcutGeneration>=Number.MAX_SAFE_INTEGER?0:shortcutGeneration+1;
 const bindings=SHORTCUT_REGISTRY.map(({id,code,altKey,ctrlKey,metaKey,shiftKey})=>({id,code,altKey,ctrlKey,metaKey,shiftKey}));
 target.postMessage({type:SHORTCUT_CONFIG_MESSAGE,version:SHORTCUT_VERSION,generation:shortcutGeneration,active:shortcutFrameActive(entry),bindings},entry.origin);return true;
}

function broadcastFrameActivity(){for(const entry of frameRegistry.values()){postFrameActivity(entry);postFrameShortcutConfig(entry)}}

function releaseFrame(id,allowSelected=false){
 if(!allowSelected&&id===selectedId)return false;
 const entry=frameRegistry.get(id);if(!entry)return false;
 if(pendingShortcutCommand?.frame===entry.frame)finishPendingShortcutCommand(null,'Selected Collie page was released.');
 entry.frame.remove();frameRegistry.delete(id);return true;
}

function evictionCandidate(){
 return [...frameRegistry.values()]
   .filter((entry)=>entry.id!==selectedId)
   .sort((left,right)=>left.lastVisitedAt-right.lastVisitedAt||left.id.localeCompare(right.id))[0]||null;
}

function makeFrame(node){
 while(frameRegistry.size>=iframeCacheSize){const candidate=evictionCandidate();if(!candidate)break;releaseFrame(candidate.id)}
 const origin=nodeOrigin(node);
 const value=document.createElement('iframe');
 value.className='node-frame';value.title='Collie · '+node.name;value.allow='clipboard-read; clipboard-write';value.hidden=true;
 const entry={id:node.id,origin,frame:value,route:{view:'home'},frameKey:null,lastVisitedAt:0,loaded:false,loading:false};
 value.addEventListener('load',()=>{
   entry.loaded=true;entry.loading=false;
   if(selectedId===entry.id){loading.hidden=true;announce(node.name+' Collie loaded.')}
   postFrameActivity(entry);
   postFrameShortcutConfig(entry);
 });
 frameStage.prepend(value);frameRegistry.set(entry.id,entry);return entry;
}

function ensureFrame(node){
 const origin=nodeOrigin(node);let entry=frameRegistry.get(node.id);
 if(entry&&entry.origin!==origin){releaseFrame(node.id,true);entry=null}
 if(entry)return entry;
 return makeFrame(node);
}

function showOnlyFrame(entry){
 for(const resident of frameRegistry.values())resident.frame.hidden=resident!==entry;
 empty.hidden=true;loading.hidden=!entry.loading;
 broadcastFrameActivity();
}

function scheduleQuietCleanup(){
 if(quietTimer!==null){clearTimeout(quietTimer);quietTimer=null}
 const remaining=FRAME_CACHE_QUIET_MS-(Date.now()-lastFrameVisitAt);
 if(remaining<=0){quietCleanup();return}
 quietTimer=setTimeout(()=>{quietTimer=null;quietCleanup()},Math.max(250,remaining));
}

function quietCleanup(){
 const remaining=FRAME_CACHE_QUIET_MS-(Date.now()-lastFrameVisitAt);
 if(remaining>0){scheduleQuietCleanup();return}
 for(const id of [...frameRegistry.keys()]){if(id!==selectedId)releaseFrame(id)}
}

function visitFrame(entry){
 const now=Date.now();entry.lastVisitedAt=now;lastFrameVisitAt=now;scheduleQuietCleanup();
}

function reconcileFrames(){
 const inventory=new Map(nodes.map((node)=>[node.id,nodeOrigin(node)]));
 for(const entry of [...frameRegistry.values()]){
   if(inventory.get(entry.id)!==entry.origin)releaseFrame(entry.id,true);
 }
}

function actionRequestId(){
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 return Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,18);
}

function validCorrelationId(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(value)}

function finishPendingShortcutCommand(result,error=null){
 const state=pendingShortcutCommand;if(!state)return;
 clearTimeout(state.timeout);pendingShortcutCommand=null;
 if(error){showTreeActionStatus(error,'error');state.resolve(false);return}
 if(!result.ok){showTreeActionStatus(result.error,'error');state.resolve(false);return}
 announce('Resize current Pane shortcut completed.');state.resolve(true);
}

function validShortcutResult(data,state){
 if(!data||typeof data!=='object'||data.type!==SHORTCUT_RESULT_MESSAGE||data.version!==SHORTCUT_VERSION||data.requestId!==state.requestId||data.action!==state.action||typeof data.ok!=='boolean')return false;
 return data.ok?exactMessageKeys(data,['type','version','requestId','action','ok']):exactMessageKeys(data,['type','version','requestId','action','ok','error'])&&typeof data.error==='string'&&data.error.length>0&&data.error.length<=240;
}

function dispatchSelectedShortcutAction(action){
 if(action!=='resize-current-pane'||!desktopMedia.matches||document.hidden)return Promise.resolve(false);
 const entry=activeEntry();const route=entry?.route;
 if(!entry||entry.frame.hidden||!entry.loaded||route?.view!=='pane'){showTreeActionStatus('Resize current Pane is unavailable.','error');return Promise.resolve(false)}
 if(pendingShortcutCommand){showTreeActionStatus('Another Pane shortcut is still running.','error');return Promise.resolve(false)}
 const target=entry.frame.contentWindow;if(!target){showTreeActionStatus('Selected Collie page is unavailable.','error');return Promise.resolve(false)}
 const requestId=actionRequestId();
 return new Promise((resolve)=>{
   pendingShortcutCommand={frame:entry.frame,origin:entry.origin,requestId,action,resolve,timeout:setTimeout(()=>finishPendingShortcutCommand(null,'Collie did not confirm the shortcut. Check this node before trying again.'),SHORTCUT_COMMAND_TIMEOUT_MS)};
   target.postMessage({type:SHORTCUT_COMMAND_MESSAGE,version:SHORTCUT_VERSION,requestId,action},entry.origin);
 });
}

function handleShortcutMessage(event){
 const entry=activeEntry();if(!entry||event.source!==entry.frame.contentWindow||event.origin!==entry.origin)return false;
 const data=event.data;
 if(data&&typeof data==='object'&&data.type===SHORTCUT_RESULT_MESSAGE){
   const state=pendingShortcutCommand;if(!state||state.frame!==entry.frame||state.origin!==entry.origin)return true;
   if(validShortcutResult(data,state))finishPendingShortcutCommand(data);return true;
 }
 if(!shortcutFrameActive(entry)||!data||typeof data!=='object'||data.type!==SHORTCUT_INTENT_MESSAGE)return false;
 if(!exactMessageKeys(data,['type','version','intentId','shortcutId'])||data.version!==SHORTCUT_VERSION||!validCorrelationId(data.intentId)||typeof data.shortcutId!=='string')return true;
 const shortcut=SHORTCUT_REGISTRY.find((candidate)=>candidate.id===data.shortcutId);if(!shortcut||recentShortcutIntents.has(data.intentId))return true;
 recentShortcutIntents.add(data.intentId);if(recentShortcutIntents.size>64)recentShortcutIntents.delete(recentShortcutIntents.values().next().value);
 dispatchShortcut(shortcut,{childOriginated:true});return true;
}

function exactMessageKeys(value,allowed){return Object.keys(value).every((key)=>allowed.includes(key))}

function validActionResult(data,action,requestId){
 if(!data||typeof data!=='object'||data.type!==ACTION_RESULT_MESSAGE||data.version!==ACTION_VERSION||data.requestId!==requestId||data.action!==action||typeof data.ok!=='boolean')return false;
 if(!data.ok)return exactMessageKeys(data,['type','version','requestId','action','ok','error'])&&typeof data.error==='string'&&data.error.length>0&&data.error.length<=240;
 if(action==='create-workspace'||action==='create-tab'){
   if(!exactMessageKeys(data,['type','version','requestId','action','ok','pane'])||!data.pane||typeof data.pane!=='object'||!exactMessageKeys(data.pane,['paneId','workspaceId','tabId']))return false;
   return Boolean(validPane(data.pane.paneId)&&validPane(data.pane.workspaceId)&&validPane(data.pane.tabId));
 }
 return exactMessageKeys(data,['type','version','requestId','action','ok']);
}

function finishPendingAction(result,error=null){
 const state=pendingAction;if(!state)return;
 clearTimeout(state.probeTimer);clearTimeout(state.timeout);
 if(state.temporary)state.frame.remove();
 pendingAction=null;delete shell.dataset.actionBusy;
 if(error)state.reject(error);else state.resolve(result);
}

function failPendingAction(message){finishPendingAction(null,new Error(message))}

function postActionProbe(){
 const state=pendingAction;if(!state||state.phase!=='probing')return;
 const target=state.frame.contentWindow;if(!target)return;
 target.postMessage({type:ACTION_PROBE_MESSAGE,version:ACTION_VERSION,requestId:state.requestId},state.origin);
 clearTimeout(state.probeTimer);state.probeTimer=setTimeout(postActionProbe,500);
}

function sendPendingAction(){
 const state=pendingAction;if(!state||state.phase!=='probing')return;
 const target=state.frame.contentWindow;if(!target){failPendingAction('Collie page is unavailable.');return}
 state.phase='sent';clearTimeout(state.probeTimer);clearTimeout(state.timeout);
 target.postMessage(state.request,state.origin);
 state.timeout=setTimeout(()=>failPendingAction('Collie did not confirm the action. Check the node before trying again.'),ACTION_RESULT_TIMEOUT_MS);
}

function handleActionMessage(event){
 const state=pendingAction;if(!state||event.source!==state.frame.contentWindow||event.origin!==state.origin)return false;
 const data=event.data;
 if(data&&typeof data==='object'&&data.type===ACTION_READY_MESSAGE){
   if(state.phase!=='probing'||!exactMessageKeys(data,['type','version','requestId'])||data.version!==ACTION_VERSION||data.requestId!==state.requestId)return true;
   sendPendingAction();return true;
 }
 if(!validActionResult(data,state.request.action,state.requestId))return true;
 finishPendingAction(data);return true;
}

function dispatchNodeAction(node,payload){
 if(pendingAction)return Promise.reject(new Error('Another sidebar action is still running.'));
 const origin=nodeOrigin(node);const resident=frameRegistry.get(node.id);
 const frame=resident?.frame||document.createElement('iframe');const temporary=!resident;
 if(temporary){
   frame.className='node-frame action-frame';frame.title='Collie action · '+node.name;frame.allow='clipboard-read; clipboard-write';frame.hidden=true;
   frameStage.prepend(frame);
 }
 const requestId=actionRequestId();const request={type:ACTION_REQUEST_MESSAGE,version:ACTION_VERSION,requestId,...payload};
 return new Promise((resolve,reject)=>{
   pendingAction={nodeId:node.id,origin,frame,temporary,requestId,request,phase:'probing',resolve,reject,probeTimer:null,timeout:null};
   shell.dataset.actionBusy='true';
   frame.addEventListener('load',()=>{
     const target=frame.contentWindow;if(target)target.postMessage({type:FRAME_ACTIVITY_MESSAGE,version:FRAME_ACTIVITY_VERSION,active:false},origin);
     postActionProbe();
   },{once:true});
   pendingAction.probeTimer=setTimeout(postActionProbe,0);
   pendingAction.timeout=setTimeout(()=>failPendingAction('This Collie version does not support sidebar actions, or the node is unavailable.'),ACTION_PROBE_TIMEOUT_MS);
   if(temporary)frame.src=frameHref(origin,{view:'home'});else postActionProbe();
 });
}

function closeRename({restoreFocus=false}={}){
 const target=renameTarget;renameTarget=null;renamePopover.hidden=true;renameError.hidden=true;renameError.textContent='';
 renameSave.disabled=false;renameCancel.disabled=false;
 if(restoreFocus&&target?.row?.isConnected)target.row.focus();
}

function openRename(row,target){
 if(!desktopMedia.matches||target.reachable!==true)return;
 closeSettings();renameTarget={...target,row};renameTitle.textContent='Rename '+(target.action==='rename-tab'?'Tab':'Pane');renameInput.value=target.label||'';
 renameError.hidden=true;renameError.textContent='';renamePopover.hidden=false;
 const bounds=row.getBoundingClientRect();const popupHeight=150;const below=bounds.bottom+6;const top=below+popupHeight<=innerHeight-12?below:Math.max(12,bounds.top-popupHeight-6);
 renamePopover.style.top=Math.round(top)+'px';requestAnimationFrame(()=>{renameInput.focus();renameInput.select()});
}

function bindRename(row,target){
 row.addEventListener('contextmenu',(event)=>{if(!desktopMedia.matches)return;event.preventDefault();openRename(row,target)});
 row.addEventListener('keydown',(event)=>{if(!desktopMedia.matches||(event.key!=='ContextMenu'&&!(event.shiftKey&&event.key==='F10')))return;event.preventDefault();openRename(row,target)});
}

async function createPaneFromSpace(node,target,button){
 if(node.health!=='online'||target.reachable!==true){showTreeActionStatus('This Space is currently unavailable.','error');return}
 button.disabled=true;showTreeActionStatus('Creating Pane…');
 try{
   const result=await dispatchNodeAction(node,{action:'create-tab',workspaceId:target.workspaceId,...(target.session?{session:target.session}:{})});
   if(!result.ok){showTreeActionStatus(result.error,'error');return}
   const pane=result.pane;showTreeActionStatus('New Pane ready.');
   selectTreeNode(node.id,{route:{view:'pane',spaceId:pane.workspaceId,tabId:pane.tabId,paneId:pane.paneId,...(target.session?{session:target.session}:{})}});
   void refresh({manual:true});
 }catch(error){showTreeActionStatus(error instanceof Error?error.message:String(error),'error')}
 finally{if(button.isConnected)button.disabled=false}
}

async function createSpaceFromHost(node,target,button){
 if(node.health!=='online'||target.reachable!==true){showTreeActionStatus('This Host is currently unavailable.','error');return}
 button.disabled=true;showTreeActionStatus('Creating Space…');
 try{
   const result=await dispatchNodeAction(node,{action:'create-workspace'});
   if(!result.ok){showTreeActionStatus(result.error,'error');return}
   const pane=result.pane;showTreeActionStatus('New Space ready.');
   selectTreeNode(node.id,{route:{view:'pane',spaceId:pane.workspaceId,tabId:pane.tabId,paneId:pane.paneId}});
   void refresh({manual:true});
 }catch(error){showTreeActionStatus(error instanceof Error?error.message:String(error),'error')}
 finally{if(button.isConnected)button.disabled=false}
}

async function submitRename(){
 const target=renameTarget;if(!target)return;
 const node=nodes.find((candidate)=>candidate.id===target.nodeId);if(!node||node.health!=='online'||target.reachable!==true){renameError.textContent='This node is currently unavailable.';renameError.hidden=false;return}
 const label=renameInput.value.trim();if(target.action==='rename-tab'&&!label){renameError.textContent='A Tab name is required.';renameError.hidden=false;return}
 renameError.hidden=true;renameSave.disabled=true;renameCancel.disabled=true;
 const idField=target.action==='rename-tab'?{tabId:target.targetId}:{paneId:target.targetId};
 try{
   const result=await dispatchNodeAction(node,{action:target.action,...idField,label,...(target.session?{session:target.session}:{})});
   if(!result.ok){renameError.textContent=result.error;renameError.hidden=false;return}
   const kind=target.action==='rename-tab'?'Tab':'Pane';closeRename();showTreeActionStatus(label?kind+' renamed.':kind+' label cleared.');void refresh({manual:true});
 }catch(error){renameError.textContent=error instanceof Error?error.message:String(error);renameError.hidden=false}
 finally{renameSave.disabled=false;renameCancel.disabled=false}
}

function chooseNode(){
 const candidates=[selectedId,requested(),remembered()];
 for(const id of candidates){const match=nodes.find((node)=>node.id===id);if(match)return match}
 return nodes.find((node)=>node.health==='online')||nodes[0]||null;
}

const treeKey=(nodeId,session,kind,id)=>[nodeId,session,kind,id].join('|');

function focusTreeKey(key){
 const target=[...instances.querySelectorAll('[data-tree-key]')].find((entry)=>entry.dataset.treeKey===key);if(target)target.focus();
}

function toggleTree(key){
 const expanded=!expandedTreeKeys.has(key);if(expanded)expandedTreeKeys.add(key);else expandedTreeKeys.delete(key);
 const row=[...instances.querySelectorAll('[data-tree-key]')].find((entry)=>entry.dataset.treeKey===key);
 const group=[...instances.querySelectorAll('[data-tree-children]')].find((entry)=>entry.dataset.treeChildren===key);
 if(!row||!group){renderTree(key);return}
 row.setAttribute('aria-expanded',String(expanded));group.dataset.expanded=String(expanded);group.inert=!expanded;group.setAttribute('aria-hidden',String(!expanded));row.focus();
}

function handleDisclosureKey(event,key){
 if((!desktopMedia.matches&&!treeOpen)||(event.key!=='ArrowRight'&&event.key!=='ArrowLeft'))return;
 const shouldOpen=event.key==='ArrowRight';if(expandedTreeKeys.has(key)===shouldOpen)return;
 event.preventDefault();toggleTree(key);
}

function treeChevron(){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','tree-chevron');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.dataset.icon='chevron-right';
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','m9 18 6-6-6-6');svg.append(path);return svg;
}

function treeChildrenGroup(key,expanded){
 const group=element('div','tree-children');group.setAttribute('role','group');group.dataset.treeChildren=key;group.dataset.expanded=String(expanded);group.inert=!expanded;group.setAttribute('aria-hidden',String(!expanded));
 const inner=element('div','tree-children-inner');group.append(inner);return {group,inner};
}

function disclosureRow(level,key,label,expanded,options={}){
 const button=element('button','tree-row tree-row-level-'+level);button.type='button';button.dataset.treeKey=key;
 button.setAttribute('role','treeitem');button.setAttribute('aria-level',String(level));button.setAttribute('aria-expanded',String(expanded));
 if(options.stale)button.dataset.stale='true';
 const chevron=treeChevron();
 const name=element('span','tree-label',label);button.append(chevron,name);
 if(options.hint)button.append(element('span','tree-hint',options.hint));
 button.addEventListener('click',()=>toggleTree(key));button.addEventListener('keydown',(event)=>handleDisclosureKey(event,key));return button;
}

function paneLabel(pane){
 if(pane.label)return pane.label;
 if(pane.kind==='agent'&&pane.agent)return pane.agent;
 const suffix=String(pane.paneId).split(':').pop();return 'Pane '+(suffix||pane.paneId);
}

function validTabPanes(tab){
 const panes=[];const seen=new Set();
 for(const pane of Array.isArray(tab.panes)?tab.panes:[]){const paneId=validPane(pane&&pane.paneId);if(!paneId||seen.has(paneId))continue;seen.add(paneId);panes.push({pane,paneId})}
 return panes;
}

function appendPaneTreatment(row,pane,label){
 const paneState=pane.kind==='shell'?'shell':statusLabel(pane.status);const paneDot=element('span','tree-pane-dot');
 paneDot.style.setProperty('--tree-pane-color',pane.kind==='shell'?'var(--status-idle)':statusColor(pane.status));paneDot.setAttribute('aria-hidden','true');
 row.append(paneDot,element('span','tree-label',label),element('span','tree-hint',paneState));return paneState;
}

function renderHostSwitcher(focusSelected=false){
 hostSwitcher.replaceChildren();
 for(const node of nodes){
   const button=element('button','instance-tab host-switcher-tab');button.type='button';button.setAttribute('role','tab');button.dataset.instance=node.id;button.dataset.health=node.health;
   const selected=node.id===selectedId;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;button.setAttribute('aria-label',node.name+' · '+healthLabel(node.health));
   const dot=element('span','status-dot');dot.setAttribute('aria-hidden','true');button.append(dot,element('span','instance-name',node.name));
   button.addEventListener('click',()=>selectNode(node.id,{focusTab:true}));hostSwitcher.append(button);
 }
 if(focusSelected){const active=hostSwitcher.querySelector('[data-instance][aria-selected="true"]');if(active){active.scrollIntoView({block:'nearest',inline:'nearest'});active.focus()}}
}

function renderTree(focusKey=null){
 instances.replaceChildren();const liveKeys=new Set();const nextPaneShortcutTargets=[];
 const route=activeEntry()?.route||requestedRoute();
 if(route?.view==='pane'&&route.spaceId&&route.tabId&&route.paneId&&selectedId){
  const hostKey=treeKey(selectedId,route.session||'','host',selectedId);
  const spaceKey=treeKey(selectedId,route.session||'','space',route.spaceId);
  const tabKey=treeKey(selectedId,route.session||'','tab',route.tabId);
  expandedTreeKeys.add(hostKey);expandedTreeKeys.add(spaceKey);expandedTreeKeys.add(tabKey);
 }
 for(const node of nodes){
   const hostKey=treeKey(node.id,'','host',node.id);liveKeys.add(hostKey);
   if(!initializedHostKeys.has(hostKey)){initializedHostKeys.add(hostKey);expandedTreeKeys.add(hostKey)}
   const wrapper=element('div','host-tree');wrapper.setAttribute('role','none');
   const trees=Array.isArray(node.treeSessions)?node.treeSessions:[];
   const primaryTree=trees.find((tree)=>tree&&tree.primarySession===true);
   const button=element('button','instance-tab tree-row tree-row-level-1');
   button.type='button';button.setAttribute('role','treeitem');button.setAttribute('aria-level','1');button.setAttribute('aria-expanded',String(expandedTreeKeys.has(hostKey)));
   button.dataset.instance=node.id;button.dataset.treeKey=hostKey;button.dataset.health=node.health;
   button.setAttribute('aria-selected',String(node.id===selectedId));button.setAttribute('aria-label',node.name+' · '+healthLabel(node.health));
   const chevron=treeChevron();
   const dot=element('span','status-dot');dot.setAttribute('aria-hidden','true');
   const label=element('span','instance-name tree-label',node.name);button.append(chevron,dot,label);
   button.addEventListener('click',(event)=>{
     if((desktopMedia.matches||treeOpen)&&event.target.closest('.tree-chevron')){toggleTree(hostKey);return}
     if(desktopMedia.matches||treeOpen){selectTreeNode(node.id,{route:{view:'home'},focusTreeKey:hostKey});return}
     selectNode(node.id,{focusTreeKey:hostKey});
   });
   button.addEventListener('keydown',(event)=>handleDisclosureKey(event,hostKey));
   const hostRowWrap=element('div','tree-row-wrap');hostRowWrap.setAttribute('role','none');
   const addSpace=element('button','tree-inline-action','+');addSpace.type='button';addSpace.setAttribute('aria-label','New Space on '+node.name);addSpace.title='New Space';
   addSpace.hidden=node.health!=='online'||primaryTree?.reachable!==true;addSpace.addEventListener('click',(event)=>{event.stopPropagation();void createSpaceFromHost(node,{reachable:primaryTree?.reachable===true},addSpace)});
   hostRowWrap.append(button,addSpace);
   const {group:hostChildren,inner:hostChildrenInner}=treeChildrenGroup(hostKey,expandedTreeKeys.has(hostKey));
   for(const tree of trees){
     const session=tree.primarySession?'':validSession(tree.herdrSession);if(!tree.primarySession&&!session)continue;const sessionHint=trees.length>1&&!tree.primarySession?session:'';
     for(const space of Array.isArray(tree.spaces)?tree.spaces:[]){
       const spaceId=validPane(space.workspaceId);if(!spaceId)continue;
       const spaceKey=treeKey(node.id,session,'space',spaceId);liveKeys.add(spaceKey);
       const spaceOpen=expandedTreeKeys.has(spaceKey);
       const spaceRow=disclosureRow(2,spaceKey,space.label||'Space '+space.number,spaceOpen,{stale:!tree.reachable,hint:sessionHint});
       const spaceRowWrap=element('div','tree-row-wrap');spaceRowWrap.setAttribute('role','none');
       const addPane=element('button','tree-inline-action','+');addPane.type='button';addPane.setAttribute('aria-label','New Pane in '+(space.label||'Space '+space.number));addPane.title='New Pane';
       addPane.hidden=!tree.reachable;addPane.addEventListener('click',(event)=>{event.stopPropagation();void createPaneFromSpace(node,{workspaceId:spaceId,session:!tree.primarySession&&session?session:'',reachable:tree.reachable},addPane)});
       spaceRowWrap.append(spaceRow,addPane);
       const {group:spaceChildren,inner:spaceChildrenInner}=treeChildrenGroup(spaceKey,spaceOpen);
       for(const tab of Array.isArray(space.tabs)?space.tabs:[]){
         const tabId=validPane(tab.tabId);if(!tabId)continue;
         const tabKey=treeKey(node.id,session,'tab',tabId);liveKeys.add(tabKey);
         const tabLabel=tab.label||'Tab '+tab.number;const validPanes=validTabPanes(tab);
         if(validPanes.length<=1)expandedTreeKeys.delete(tabKey);
         if(validPanes.length===0){
           const tabRow=element('button','tree-row tree-row-level-3');tabRow.type='button';tabRow.dataset.treeKey=tabKey;tabRow.dataset.disabled='true';
           tabRow.setAttribute('role','treeitem');tabRow.setAttribute('aria-level','3');tabRow.setAttribute('aria-disabled','true');if(!tree.reachable)tabRow.dataset.stale='true';
           tabRow.append(element('span','tree-label',tabLabel));if(tree.reachable)bindRename(tabRow,{nodeId:node.id,action:'rename-tab',targetId:tabId,label:tabLabel,session:!tree.primarySession&&session?session:'',reachable:true});spaceChildrenInner.append(tabRow);continue;
         }
         if(validPanes.length===1){
           const {pane,paneId}=validPanes[0];const tabRow=element('button','tree-row tree-row-level-3 direct-pane-tree-row');tabRow.type='button';tabRow.dataset.treeKey=tabKey;
           nextPaneShortcutTargets.push({key:shortcutPaneKey(node.id,paneId,tree.primarySession?'':session),nodeId:node.id,treeKey:tabKey,route:{view:'pane',spaceId,tabId,paneId,...(!tree.primarySession&&session?{session}:{})}});
           tabRow.setAttribute('role','treeitem');tabRow.setAttribute('aria-level','3');if(!tree.reachable)tabRow.dataset.stale='true';
           const selected=node.id===selectedId&&route.view==='pane'&&route.paneId===paneId&&(route.session||'')===(tree.primarySession?'':session);
           tabRow.setAttribute('aria-selected',String(selected));const paneState=appendPaneTreatment(tabRow,pane,tabLabel);tabRow.setAttribute('aria-label',tabLabel+' · '+paneState);
           tabRow.addEventListener('click',()=>selectTreeNode(node.id,{route:{view:'pane',spaceId,tabId,paneId,...(!tree.primarySession&&session?{session}:{})},focusTreeKey:tabKey}));
           if(tree.reachable)bindRename(tabRow,{nodeId:node.id,action:'rename-tab',targetId:tabId,label:tabLabel,session:!tree.primarySession&&session?session:'',reachable:true});
           spaceChildrenInner.append(tabRow);continue;
         }
         const tabOpen=expandedTreeKeys.has(tabKey);
         const tabRow=disclosureRow(3,tabKey,tabLabel,tabOpen,{stale:!tree.reachable});
         if(tree.reachable)bindRename(tabRow,{nodeId:node.id,action:'rename-tab',targetId:tabId,label:tabLabel,session:!tree.primarySession&&session?session:'',reachable:true});
         const {group:tabChildren,inner:tabChildrenInner}=treeChildrenGroup(tabKey,tabOpen);
         for(const {pane,paneId} of validPanes){
           const paneKey=treeKey(node.id,session,'pane',paneId);liveKeys.add(paneKey);
           nextPaneShortcutTargets.push({key:shortcutPaneKey(node.id,paneId,tree.primarySession?'':session),nodeId:node.id,treeKey:paneKey,route:{view:'pane',spaceId,tabId,paneId,...(!tree.primarySession&&session?{session}:{})}});
           const paneRow=element('button','tree-row tree-row-level-4 pane-tree-row');paneRow.type='button';paneRow.dataset.treeKey=paneKey;
           paneRow.setAttribute('role','treeitem');paneRow.setAttribute('aria-level','4');if(!tree.reachable)paneRow.dataset.stale='true';
           const selected=node.id===selectedId&&route.view==='pane'&&route.paneId===paneId&&(route.session||'')===(tree.primarySession?'':session);
           paneRow.setAttribute('aria-selected',String(selected));
           appendPaneTreatment(paneRow,pane,paneLabel(pane));
           paneRow.addEventListener('click',()=>selectTreeNode(node.id,{route:{view:'pane',spaceId,tabId,paneId,...(!tree.primarySession&&session?{session}:{})},focusTreeKey:paneKey}));
           if(tree.reachable)bindRename(paneRow,{nodeId:node.id,action:'rename-pane',targetId:paneId,label:pane.label||'',session:!tree.primarySession&&session?session:'',reachable:true});
           tabChildrenInner.append(paneRow);
         }
         spaceChildrenInner.append(tabRow,tabChildren);
       }
       hostChildrenInner.append(spaceRowWrap,spaceChildren);
     }
   }
   wrapper.append(hostRowWrap,hostChildren);instances.append(wrapper);
 }
 paneShortcutTargets=nextPaneShortcutTargets;
 for(const key of [...expandedTreeKeys]){if(!liveKeys.has(key))expandedTreeKeys.delete(key)}
 const active=focusKey?[...instances.querySelectorAll('[data-tree-key]')].find((entry)=>entry.dataset.treeKey===focusKey):instances.querySelector('[data-instance][aria-selected="true"]');
 if(active){active.scrollIntoView({block:'nearest',inline:'nearest'});if(focusKey)active.focus()}
}

function renderTabs(focusSelected=false){
 renderTree(typeof focusSelected==='string'?focusSelected:null);renderHostSwitcher(focusSelected===true);
}

function updateHealth(node){
 const healthy=node.health==='online';
 notice.hidden=healthy;
 if(!healthy){const detail=node.message?' · '+node.message:'';noticeText.textContent=node.name+' · '+healthLabel(node.health)+detail}
}

function syncFallbackEntry(){
 let link=hostRailFooter.querySelector('[data-fallback-entry]');
 const node=selectedNode();const href=fallbackDesktopMedia.matches?fallbackHref(node):null;
 if(!href){if(link)link.remove();return}
 if(!link){link=element('a','desktop-fallback-entry','Emergency terminal');link.dataset.fallbackEntry='true';link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';hostRailFooter.insertBefore(link,settingsAnchor)}
 link.href=href;link.title='Open '+node.name+' emergency terminal';link.setAttribute('aria-label','Open '+node.name+' emergency terminal in a new tab');
}

function loadSelected(force=false,routeOverride=null){
 const node=selectedNode();if(!node)return;
 const entry=ensureFrame(node);let route=routeOverride||entry.route||{view:'home'};
 if(route.invalid)route={view:'home'};
 else if(route.view==='pane')route=canonicalPaneRoute(route.paneId,route.session,route.spaceId,route.tabId);
 const href=frameHref(entry.origin,route);const nextFrameKey=routeKey(entry.origin,route);
 entry.route=route;entry.frame.title='Collie · '+node.name;
 openNode.href=href;openNode.hidden=false;updateHealth(node);
 syncFallbackEntry();
 if(force||entry.frameKey!==nextFrameKey){entry.frameKey=nextFrameKey;entry.loading=true;entry.frame.src=href}
 showOnlyFrame(entry);replaceUrl(node.id,route);
}

function selectNode(id,options={}){
 const node=nodes.find((candidate)=>candidate.id===id);if(!node)return;
 const existing=frameRegistry.get(id);
 const supplied=options.route&&(options.route.view==='pane'||options.route.view==='home')?options.route:null;
 let route=supplied||(options.routeFromUrl?requestedRoute():existing?.route||{view:'home'});
 selectedId=id;remember(id);
 const entry=ensureFrame(node);
 route=route.invalid?{view:'home'}:route.view==='pane'?canonicalPaneRoute(route.paneId,route.session,route.spaceId,route.tabId):route;
 entry.route=route;visitFrame(entry);replaceUrl(id,route);
 renderTabs(options.focusTreeKey||Boolean(options.focusTab));
 loadSelected(Boolean(options.forceFrame),route);
 announce('Selected '+node.name+'. '+healthLabel(node.health)+'.');
}

function selectTreeNode(id,options={}){
 const compactTree=treeOpen&&!desktopMedia.matches;
 selectNode(id,compactTree?{...options,focusTreeKey:false}:options);
 if(compactTree)closeTreeMenu({restoreFocus:true});
}

function showEmpty(title,copy){
 for(const id of [...frameRegistry.keys()])releaseFrame(id,true);
 selectedId=null;hostSwitcher.replaceChildren();instances.replaceChildren();openNode.hidden=true;notice.hidden=true;loading.hidden=true;
 syncFallbackEntry();
 emptyTitle.textContent=title;emptyCopy.textContent=copy;empty.hidden=false;announce(title+'. '+copy);
}

function agentParts(agent){
 const project=agent.workspaceLabel||agent.workspaceId;
 const own=agent.paneLabel||agent.sessionName||'';
 const cwd=!agent.cwd||baseName(agent.cwd).toLowerCase()===String(project).trim().toLowerCase()?'':shortCwd(agent.cwd);
 return {project,tab:agent.tabLabel||'',secondary:own||cwd};
}

function bucket(agent){
 if(agent.status==='blocked')return'needs';
 if(agent.status==='done'&&(agent.lastActiveAt||0)>(agent.lastSeenAt||0))return'ready';
 if(agent.status==='working')return'working';
 return'recent';
}

function sortAgentEntries(key,entries){
 const copy=[...entries];
 copy.sort((a,b)=>{
   const favoriteOrder=Number(agentFavorites.has(agentFavoriteKey(b.node,b.agent)))-Number(agentFavorites.has(agentFavoriteKey(a.node,a.agent)));if(favoriteOrder)return favoriteOrder;
   return key==='needs'||key==='ready'||key==='working'?(b.agent.lastActiveAt||0)-(a.agent.lastActiveAt||0):(b.agent.lastSeenAt||0)-(a.agent.lastSeenAt||0);
 });
 return copy;
}

function selectAgent(node,agent){
 const resetAttention=Boolean(agent.reachable)&&(bucket(agent)==='ready'||bucket(agent)==='needs');
 const spaceId=validPane(agent.workspaceId);const tabId=validPane(agent.tabId);const paneId=validPane(agent.paneId);const session=agent.primarySession?null:validSession(agent.herdrSession);
 if(!spaceId||!tabId||!paneId||(!agent.primarySession&&!session))return;
 closeAgentMenu();
 selectNode(node.id,{route:{view:'pane',spaceId,tabId,paneId,...(session?{session}:{})}});
 if(resetAttention)void refresh({manual:true});
}

function focusSelectedFrame(){
 requestAnimationFrame(()=>requestAnimationFrame(()=>{const entry=activeEntry();if(!entry||entry.frame.hidden)return;try{entry.frame.focus({preventScroll:true})}catch{entry.frame.focus()}}));
}

function cyclePaneShortcut(delta,childOriginated=false){
 const entry=activeEntry();const route=entry?.route;
 if(!entry||route?.view!=='pane'){showTreeActionStatus('No current Pane is available for keyboard navigation.','error');return}
 const currentKey=shortcutPaneKey(entry.id,route.paneId,route.session||'');const index=paneShortcutTargets.findIndex((target)=>target.key===currentKey);
 if(index<0||paneShortcutTargets.length===0){showTreeActionStatus('The current Pane is not in the Fleet tree.','error');return}
 const target=paneShortcutTargets[(index+delta+paneShortcutTargets.length)%paneShortcutTargets.length];
 selectTreeNode(target.nodeId,{route:target.route,focusTreeKey:target.treeKey});
 if(childOriginated)focusSelectedFrame();
}

function selectAgentShortcut(ordinal,childOriginated=false){
 const target=agentShortcutTargets[ordinal-1];
 if(!target){showTreeActionStatus('Agent shortcut '+ordinal+' is unavailable.','error');return}
 selectAgent(target.node,target.agent);if(childOriginated)focusSelectedFrame();
}

function cycleAgentShortcut(delta,childOriginated=false){
 if(!agentShortcutTargets.length){showTreeActionStatus('No Agents are available for keyboard navigation.','error');return}
 const route=activeEntry()?.route||requestedRoute();
 const currentKey=route?.view==='pane'?(route.nodeId||selectedId)+'|'+(route.paneId||'')+'|'+(route.session||''):null;
 const index=currentKey?agentShortcutTargets.findIndex((entry)=>entry.node.id+'|'+entry.agent.paneId+'|'+(entry.agent.primarySession?'':entry.agent.herdrSession)===currentKey):-1;
 let target;
 if(index>=0)target=agentShortcutTargets[(index+delta+agentShortcutTargets.length)%agentShortcutTargets.length];
 else target=delta>0?agentShortcutTargets[0]:agentShortcutTargets[agentShortcutTargets.length-1];
 selectAgent(target.node,target.agent);if(childOriginated)focusSelectedFrame();
}

function dispatchShortcut(shortcut,{childOriginated=false}={}){
 if(!shortcut||shortcut.scope!=='desktop'||!desktopMedia.matches||document.hidden)return false;
 showShortcutToast(shortcut);
 if(shortcut.action.kind==='cycle-pane'){cyclePaneShortcut(shortcut.action.delta,childOriginated);return true}
 if(shortcut.action.kind==='cycle-agent'){cycleAgentShortcut(shortcut.action.delta,childOriginated);return true}
 if(shortcut.action.kind==='select-agent'){selectAgentShortcut(shortcut.action.ordinal,childOriginated);return true}
 if(shortcut.action.kind==='resize-current-pane'){void dispatchSelectedShortcutAction(shortcut.action.kind);return true}
 return false;
}

function agentFavoriteIcon(){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','agent-favorite-icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.dataset.icon='star';
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z');svg.append(path);return svg;
}

function toggleAgentFavorite(node,agent){
 const key=agentFavoriteKey(node,agent);const removing=agentFavorites.has(key);
 if(removing)agentFavorites.delete(key);else{if(agentFavorites.size>=AGENT_FAVORITES_MAX){const oldest=agentFavorites.values().next().value;if(oldest!==undefined)agentFavorites.delete(oldest)}agentFavorites.add(key)}
 pendingFavoriteFocusKey=key;persistAgentFavorites();renderAgents(key);announce((removing?'Removed favorite ':'Favorited ')+(agentParts(agent).project||agent.agent)+'.');
}

function renderAgentCard(node,agent,ordinal=null){
 const parts=agentParts(agent);
 const favoriteKey=agentFavoriteKey(node,agent);const isFavorite=agentFavorites.has(favoriteKey);
 const card=element('div','agent-card');card.dataset.live=String(Boolean(agent.reachable));card.dataset.status=agent.status;card.dataset.favorite=String(isFavorite);
 const route=activeEntry()?.route||requestedRoute();
 const cardSession=agent.primarySession?'':agent.herdrSession;
 if(route?.view==='pane'&&route.paneId===agent.paneId&&(route.session||'')===cardSession&&selectedId===node.id)card.dataset.currentPane='true';
 const shortcutLabel=ordinal?' · Shortcut Alt+'+ordinal:'';
 const main=element('button','agent-card-main');main.type='button';main.setAttribute('aria-label',(agent.reachable?'':'Offline · ')+node.name+' · '+parts.project+(parts.tab?' · '+parts.tab:'')+' · '+statusLabel(agent.status)+shortcutLabel);
 const avatar=element('span','agent-avatar',initials(agent.agent));avatar.dataset.brand=brand(agent.agent);avatar.setAttribute('aria-hidden','true');
 const dot=element('span','agent-status-dot');dot.style.setProperty('--agent-status-color',statusColor(agent.status));avatar.append(dot);
 if(ordinal){const badge=element('span','agent-ordinal-badge',String(ordinal));badge.setAttribute('aria-hidden','true');avatar.append(badge)}
 const copy=element('span','agent-card-copy');
 const title=element('span','agent-title-line');title.dataset.hasTab=String(Boolean(parts.tab));
 title.append(element('span','agent-project',parts.project));
 if(parts.tab){title.append(element('span','agent-separator','·'),element('span','agent-tab',parts.tab))}
 const meta=element('span','agent-meta-line');
 const secondary=[parts.secondary,!agent.primarySession?agent.herdrSession:''].filter(Boolean).join(' · ');
 meta.append(element('span','agent-secondary',secondary||agent.agent));
 const host=element('span','host-chip',node.name);host.title=node.publicHost;meta.append(host);
 if(agent.reachable){const stamp=agent.status==='done'?agent.lastSeenAt:agent.lastActiveAt;if(Number.isSafeInteger(stamp))meta.append(element('span','agent-age',timeAgo(stamp)))}
 else{meta.append(element('span','offline-chip','offline'));if(Number.isSafeInteger(agent.observedAt))meta.append(element('span','agent-age',timeAgo(agent.observedAt)))}
 const favorite=element('button','agent-favorite');favorite.type='button';favorite.dataset.favoriteKey=favoriteKey;favorite.setAttribute('aria-pressed',String(isFavorite));favorite.setAttribute('aria-label',(isFavorite?'Remove favorite ':'Favorite ')+parts.project+(parts.tab?' · '+parts.tab:''));favorite.title=isFavorite?'Remove from favorites':'Add to favorites';favorite.append(agentFavoriteIcon());favorite.addEventListener('click',()=>toggleAgentFavorite(node,agent));
 const tools=element('div','agent-card-tools');
 tools.append(favorite);copy.append(title,meta);main.append(avatar,copy);main.addEventListener('click',()=>selectAgent(node,agent));card.append(main,tools);return card;
}

function renderAgents(focusFavoriteKey=null){
 const favoriteFocusKey=focusFavoriteKey||document.activeElement?.dataset?.favoriteKey||pendingFavoriteFocusKey;
 agentSections.replaceChildren();const nextAgentShortcutTargets=[];
 const entries=[];
 for(const node of nodes){for(const agent of Array.isArray(node.agentEntries)?node.agentEntries:[])entries.push({node,agent})}
 const live=entries.filter(({agent})=>agent.reachable).length;
 const offline=entries.length-live;
 const counted=entries.filter(({agent})=>bucket(agent)!=='recent').length;
 agentMenuCount.textContent=String(counted);
 agentMenuToggle.title='All Agents · '+counted+' outside Recent';
 agentMenuToggle.setAttribute('aria-label','Open all Agents · '+counted+' outside Recent · '+live+' live'+(offline?' · '+offline+' offline':''));
 if(!entries.length){agentShortcutTargets=[];agentSections.append(element('p','agent-empty','No agents running.'));return}
 const sections=[
   {key:'needs',label:'Needs you',color:'var(--status-blocked)',attention:true},
   {key:'ready',label:'Ready · unseen',color:'var(--status-done)',attention:true},
   {key:'working',label:'Working',color:'var(--status-working)'},
   {key:'recent',label:'Recent',color:'var(--status-idle)'},
 ];
 for(const section of sections){
   const matching=sortAgentEntries(section.key,entries.filter(({agent})=>bucket(agent)===section.key));
   if(!matching.length)continue;
   const wrapper=element('section','agent-section');wrapper.dataset.section=section.key;wrapper.dataset.attention=String(Boolean(section.attention));
   const heading=element('h2','agent-section-heading');heading.dataset.section=section.key;heading.style.setProperty('--section-color',section.color);
   heading.append(element('span','section-dot'),element('span','',section.label),element('span','section-count',matching.length));
   const list=element('div','agent-card-list');
   for(const entry of matching){const ordinal=desktopMedia.matches&&nextAgentShortcutTargets.length<9?nextAgentShortcutTargets.length+1:null;if(ordinal)nextAgentShortcutTargets.push(entry);list.append(renderAgentCard(entry.node,entry.agent,ordinal))}
   wrapper.append(heading,list);agentSections.append(wrapper);
 }
 agentShortcutTargets=nextAgentShortcutTargets;
 if(favoriteFocusKey){const target=[...agentSections.querySelectorAll('[data-favorite-key]')].find((entry)=>entry.dataset.favoriteKey===favoriteFocusKey);if(target)requestAnimationFrame(()=>{if(target.isConnected)target.focus();if(pendingFavoriteFocusKey===favoriteFocusKey)pendingFavoriteFocusKey=null})}
}

function renderInventory(data){
 nodes=Array.isArray(data.nodes)?data.nodes.filter((node)=>node&&typeof node.id==='string'&&typeof node.name==='string'&&typeof node.publicHost==='string'):[];
 reconcileFrames();
 renderAgents();
 if(!nodes.length){showEmpty('No instances','No enabled Herdr instances are configured.');return}
 const choice=chooseNode();
 if(!choice){showEmpty('No instances','No enabled Herdr instances are configured.');return}
 if(choice.id!==selectedId)selectNode(choice.id,{routeFromUrl:requested()===choice.id});
 else{renderTabs();loadSelected(false)}
}

function syncTreePresentation(){
 const hidden=!desktopMedia.matches&&!treeOpen;instances.inert=hidden;instances.setAttribute('aria-hidden',String(hidden));
}

function closeTreeMenu(options={}){
 if(!desktopMedia.matches&&!settingsPopover.hidden)closeSettings();
 treeOpen=false;delete shell.dataset.treeOpen;treeMenuBackdrop.hidden=true;treeMenuToggle.setAttribute('aria-expanded','false');treeMenuToggle.setAttribute('aria-label','Open Host tree');
 syncTreePresentation();
 if(options.restoreFocus&&!desktopMedia.matches)treeMenuToggle.focus();
 if(options.syncActivity!==false)broadcastFrameActivity();
}

function openTreeMenu(){
 if(desktopMedia.matches)return;
 closeAgentMenu({syncActivity:false});treeOpen=true;shell.dataset.treeOpen='true';treeMenuBackdrop.hidden=false;treeMenuToggle.setAttribute('aria-expanded','true');treeMenuToggle.setAttribute('aria-label','Close Host tree');broadcastFrameActivity();
 syncTreePresentation();
}

function closeAgentMenu(options={}){if(desktopMedia.matches)return;agentMenu.hidden=true;agentMenuToggle.setAttribute('aria-expanded','false');if(options.syncActivity!==false)broadcastFrameActivity()}

function openAgentMenu(){
 closeTreeMenu({syncActivity:false});agentMenu.hidden=false;agentMenuToggle.setAttribute('aria-expanded','true');renderAgents();broadcastFrameActivity();
 void refresh({manual:true});
}

function syncAgentMenuLayout(){
 const nextDesktop=desktopMedia.matches;
 if(nextDesktop){closeTreeMenu();agentMenu.hidden=false;agentMenuToggle.setAttribute('aria-expanded','false')}
 else if(desktopMode){closeSettings();closeRename();agentMenu.hidden=true;agentMenuToggle.setAttribute('aria-expanded','false')}
 desktopMode=nextDesktop;renderAgents();syncTreePresentation();renderTabs();syncFallbackEntry();applyRailWidthPreferences();broadcastFrameActivity();
}

function clearRefreshTimer(){if(refreshTimer!==null){clearTimeout(refreshTimer);refreshTimer=null}}
function scheduleRefresh(waitMs){
 const delay=Number.isSafeInteger(waitMs)?Math.max(MIN_REFRESH_TIMER_MS,waitMs):DEFAULT_REFRESH_MS;
 clearRefreshTimer();agentRefreshState.textContent='Next refresh in '+formatDelay(delay);
 refreshTimer=setTimeout(()=>{refreshTimer=null;void refresh()},delay);
}

async function refresh(options={}){
 const manual=Boolean(options.manual);
 if(manual)clearRefreshTimer();
 if(refreshing){if(manual)queuedManualRefresh=true;return}
 refreshing=true;agentRefreshState.textContent='Refreshing…';
 let nextWaitMs=DEFAULT_REFRESH_MS;
 try{
   const response=await fetch(manual?'/api/fleet?manual=1':'/api/fleet',{headers:{accept:'application/json'},cache:'no-store'});
   if(response.status===401){location.assign('/auth/login?next='+encodeURIComponent(location.href));return}
   if(!response.ok)throw new Error('HTTP '+response.status);
   const data=await response.json();
   const generatedAt=Number.isSafeInteger(data.generatedAt)?data.generatedAt:null;
   const nextAt=data.refresh&&Number.isSafeInteger(data.refresh.nextAt)?data.refresh.nextAt:null;
   if(generatedAt!==null&&nextAt!==null)nextWaitMs=Math.max(MIN_REFRESH_TIMER_MS,nextAt-generatedAt);
   renderInventory(data);
 }catch(error){
   const message=error instanceof Error?error.message:String(error);
   if(!nodes.length)showEmpty('Fleet unavailable','Could not load instance inventory. '+message);
   announce('Fleet refresh failed. '+message);
 }finally{
   refreshing=false;
   if(queuedManualRefresh){queuedManualRefresh=false;void refresh({manual:true});return}
   scheduleRefresh(nextWaitMs);
 }
}

hostSwitcher.addEventListener('keydown',(event)=>{
 if(desktopMedia.matches||!event.target.closest('.host-switcher-tab'))return;
 if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
 const index=nodes.findIndex((node)=>node.id===selectedId);if(index<0)return;
 event.preventDefault();const delta=event.key==='ArrowRight'?1:-1;const next=nodes[(index+delta+nodes.length)%nodes.length];if(next)selectNode(next.id,{focusTab:true});
});
treeMenuToggle.addEventListener('click',()=>{if(treeOpen)closeTreeMenu({restoreFocus:true});else openTreeMenu()});
treeMenuBackdrop.addEventListener('click',()=>closeTreeMenu({restoreFocus:true}));
agentMenuToggle.addEventListener('click',()=>{if(agentMenu.hidden)openAgentMenu();else closeAgentMenu()});
settingsToggle.addEventListener('click',()=>{if(settingsPopover.hidden)openSettings();else closeSettings({restoreFocus:true})});
cacheSizeSelect.value=String(iframeCacheSize);
cacheSizeSelect.addEventListener('change',()=>setIframeCacheSize(cacheSizeSelect.value));
cacheReset.addEventListener('click',()=>{try{localStorage.removeItem(CACHE_STORAGE_KEY)}catch{}setIframeCacheSize(defaultCacheSize,{persist:false})});
renameCancel.addEventListener('click',()=>closeRename({restoreFocus:true}));
renameForm.addEventListener('submit',(event)=>{event.preventDefault();void submitRename()});
document.addEventListener('pointerdown',(event)=>{
 if(!desktopMedia.matches&&!agentMenu.hidden&&!agentMenu.contains(event.target)&&!agentMenuToggle.contains(event.target))closeAgentMenu();
 if((desktopMedia.matches||treeOpen)&&!settingsPopover.hidden&&!settingsPopover.contains(event.target)&&!settingsToggle.contains(event.target))closeSettings();
 if(desktopMedia.matches&&!renamePopover.hidden&&!renamePopover.contains(event.target)&&!event.target.closest('[data-tree-key]'))closeRename();
});
document.addEventListener('keydown',(event)=>{
 const shortcut=matchShortcut(event);if(shortcut){event.preventDefault();dispatchShortcut(shortcut);return}
 if(event.key!=='Escape')return;
 if(!settingsPopover.hidden){closeSettings({restoreFocus:true});return}
 if(desktopMedia.matches&&!renamePopover.hidden){closeRename({restoreFocus:true});return}
 if(desktopMedia.matches)return;
 if(treeOpen){closeTreeMenu({restoreFocus:true});return}
 if(!agentMenu.hidden){closeAgentMenu();agentMenuToggle.focus()}
});
addEventListener('message',(event)=>{
 if(handleShortcutMessage(event))return;
 if(handleActionMessage(event))return;
 const entry=[...frameRegistry.values()].find((candidate)=>event.source===candidate.frame.contentWindow);if(!entry||event.origin!==entry.origin)return;
 const data=event.data;
 if(!data||typeof data!=='object'||data.type!==ROUTE_MESSAGE||data.version!==1)return;
 if(Object.keys(data).some((key)=>!['type','version','view','spaceId','tabId','paneId','session'].includes(key)))return;
 const hasSession=Object.prototype.hasOwnProperty.call(data,'session');
 const session=hasSession?validSession(data.session):null;
 if(hasSession&&!session)return;
 let route;
 if(data.view==='home'){
   if(Object.prototype.hasOwnProperty.call(data,'spaceId')||Object.prototype.hasOwnProperty.call(data,'tabId')||Object.prototype.hasOwnProperty.call(data,'paneId'))return;
   route={view:'home',...(session?{session}:{})};
 }else if(data.view==='pane'){
   const paneId=validPane(data.paneId);if(!paneId)return;
   const hasSpace=Object.prototype.hasOwnProperty.call(data,'spaceId');const hasTab=Object.prototype.hasOwnProperty.call(data,'tabId');
   if(hasSpace!==hasTab)return;
   const spaceId=hasSpace?validPane(data.spaceId):null;const tabId=hasTab?validPane(data.tabId):null;
   if((hasSpace&&!spaceId)||(hasTab&&!tabId))return;
   route=canonicalPaneRoute(paneId,session,spaceId,tabId,entry.id);
 }else return;
 entry.route=route;entry.frameKey=routeKey(entry.origin,route);
 if(entry.id!==selectedId)return;
 replaceUrl(entry.id,route);openNode.href=frameHref(entry.origin,route);renderTree();
});
document.querySelector('#retry-frame').addEventListener('click',()=>loadSelected(true));
document.querySelector('#retry-inventory').addEventListener('click',()=>refresh({manual:true}));
addEventListener('popstate',()=>{const id=requested();if(nodes.some((node)=>node.id===id))selectNode(id,{routeFromUrl:true})});
bindRailResizer(hostRailResizer,'left');bindRailResizer(agentRailResizer,'right');
addEventListener('resize',applyRailWidthPreferences);
addEventListener('storage',(event)=>{if(event.key===AGENT_FAVORITES_STORAGE_KEY){agentFavorites=readAgentFavorites();renderAgents()}});
document.addEventListener('visibilitychange',broadcastFrameActivity);
desktopMedia.addEventListener('change',syncAgentMenuLayout);fallbackDesktopMedia.addEventListener('change',syncFallbackEntry);syncAgentMenuLayout();
void refresh();
`;
