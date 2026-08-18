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

export function fleetPage(iframeCacheSize = 1): string {
  const boundedCacheSize = Number.isSafeInteger(iframeCacheSize) && iframeCacheSize >= 1 && iframeCacheSize <= 10
    ? iframeCacheSize
    : 1;
  return documentShell(
    "Fleet · Collie",
    `<main class="fleet-shell" data-iframe-cache-size="${boundedCacheSize}">
      <header class="fleet-header">
        <a class="fleet-mark" href="/" aria-label="Fleet home" title="Herdr Fleet">H</a>
        <p class="rail-title">Hosts</p>
        <nav id="instances" class="instance-strip" aria-label="Herdr Hosts" role="tree">
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
      </header>
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
      <p id="fleet-status" class="sr-only" role="status">Connecting to Fleet.</p>
    </main>`,
    ["/fleet-assets/fleet.css", "/fleet-assets/fleet.js"],
  );
}

export const FLEET_CSS = `
:root {
  color-scheme: light dark;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  --radius: .65rem;
  --background: light-dark(oklch(.97 0 0), oklch(.145 0 0));
  --foreground: light-dark(oklch(.145 0 0), oklch(.985 0 0));
  --card: light-dark(oklch(1 0 0), oklch(.205 0 0));
  --muted: light-dark(oklch(.94 0 0), oklch(.269 0 0));
  --muted-foreground: light-dark(oklch(.48 0 0), oklch(.708 0 0));
  --accent: light-dark(oklch(.92 0 0), oklch(.269 0 0));
  --border: light-dark(oklch(.922 0 0), oklch(1 0 0 / 12%));
  --ring: light-dark(oklch(.62 0 0), oklch(.556 0 0));
  --status-blocked: light-dark(oklch(.46 .2 25), oklch(.7 .2 24));
  --status-working: light-dark(oklch(.46 .12 72), oklch(.82 .15 82));
  --status-done: light-dark(oklch(.45 .14 152), oklch(.74 .16 152));
  --status-idle: light-dark(oklch(.45 .02 250), oklch(.65 .02 250));
  --status-unknown: light-dark(oklch(.43 .02 250), oklch(.6 .02 250));
  --status-online: var(--status-done);
  --status-down: var(--status-blocked);
}
* { box-sizing: border-box; }
html, body { height: 100%; overflow: hidden; }
body { margin: 0; background: var(--muted); color: var(--foreground); }
button, a { font: inherit; }
button { color: inherit; }
.fleet-shell {
  position: relative;
  display: flex;
  height: 100dvh;
  width: 100%;
  flex-direction: column;
  overflow: hidden;
  background: var(--background);
  box-shadow: 0 0 0 1px var(--border), 0 18px 70px light-dark(#00000012, #00000070);
}
.rail-title { display: none; }
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
  border-radius: calc(var(--radius) - 2px);
  color: var(--foreground);
  font-size: 1rem;
  font-weight: 900;
  text-decoration: none;
}
.fleet-mark:hover, .header-action:hover { background: var(--accent); color: var(--foreground); }
.instance-strip {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: .35rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}
.instance-strip::-webkit-scrollbar { display: none; }
.host-tree { display: contents; }
.tree-children { display: none; }
.tree-chevron, .tree-pane-dot, .tree-hint { flex: none; }
.tree-chevron { display: none; width: .8rem; color: var(--muted-foreground); font-size: 1rem; line-height: 1; transition: transform .12s ease; }
.tree-row[aria-expanded="true"] > .tree-chevron { transform: rotate(90deg); }
.tree-label { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-hint { max-width: 5.5rem; overflow: hidden; color: var(--muted-foreground); font-size: .62rem; text-overflow: ellipsis; white-space: nowrap; }
.tree-pane-dot { width: .45rem; height: .45rem; border-radius: 999px; background: var(--tree-pane-color); box-shadow: 0 0 0 2px color-mix(in oklch, var(--tree-pane-color) 16%, transparent); }
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
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: .7rem;
  border: 0;
  background: transparent;
  padding: .65rem .7rem;
  color: var(--foreground);
  text-align: left;
  cursor: pointer;
  transition: background .15s ease, transform .08s ease;
}
.agent-card:hover { background: color-mix(in oklch, var(--muted) 65%, transparent); }
.agent-card:active { transform: scale(.99); }
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
.agent-card[data-live="false"] .agent-avatar, .agent-card[data-live="false"] .agent-status-dot { opacity: .45; }
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
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
@keyframes pulse { 50% { opacity: .45; transform: scale(.96); } }
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
    grid-template: minmax(0, 1fr) / 14rem minmax(40rem, 1fr) 21rem;
    grid-template-areas: "hosts frame agents";
    box-shadow: none;
  }
  .fleet-header {
    grid-area: hosts;
    min-height: 0;
    align-items: stretch;
    gap: .35rem;
    border-right: 1px solid var(--border);
    border-bottom: 0;
    padding: 1rem .75rem;
  }
  .fleet-mark { align-self: flex-start; }
  .rail-title {
    display: block;
    margin: .65rem .6rem .15rem;
    color: var(--muted-foreground);
    font-size: .68rem;
    font-weight: 800;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .instance-strip {
    flex-direction: column;
    align-items: stretch;
    gap: .2rem;
    overflow-x: hidden;
    overflow-y: auto;
  }
  .host-tree { display: block; }
  .tree-children:not([hidden]) { display: block; }
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
  .tree-row[aria-selected="true"] { background: var(--accent); color: var(--foreground); }
  .tree-row[data-stale="true"] { opacity: .58; }
  .tree-row-level-2 { padding-left: 1.25rem; }
  .tree-row-level-3 { padding-left: 2.15rem; }
  .tree-row-level-4 { padding-left: 3.05rem; }
  .instance-tab {
    width: 100%;
    max-width: none;
    justify-content: flex-start;
    border-radius: calc(var(--radius) - 1px);
    padding: 0 .5rem;
  }
  .agent-menu-toggle { display: none; }
  #open-node { margin-top: auto; }
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
  .frame-stage { grid-area: frame; }
}
@media (prefers-reduced-motion: reduce) {
  .loading-mark { animation: none; }
  .agent-card { transition: none; }
}
`;

export const FLEET_JS = `
const STORAGE_KEY='herdr-web-remote:selected-instance';
const ROUTE_MESSAGE='herdr-web-remote:route';
const DEFAULT_REFRESH_MS=5000;
const MIN_REFRESH_TIMER_MS=250;
const FRAME_CACHE_QUIET_MS=1800000;
const DESKTOP_MEDIA='(min-width: 1200px)';
const shell=document.querySelector('.fleet-shell');
const instances=document.querySelector('#instances');
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
const desktopMedia=matchMedia(DESKTOP_MEDIA);
const configuredCacheSize=Number(shell.dataset.iframeCacheSize);
const iframeCacheSize=Number.isSafeInteger(configuredCacheSize)&&configuredCacheSize>=1&&configuredCacheSize<=10?configuredCacheSize:1;
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

const healthLabel=(health)=>({online:'Online','herdr-down':'Herdr unavailable','bridge-down':'Collie unavailable','transport-down':'Transport unavailable'}[health]||'Unavailable');
const statusLabel=(status)=>({blocked:'needs you',working:'working',done:'done',idle:'idle',unknown:'unknown'}[status]||'unknown');
const statusColor=(status)=>'var(--status-'+(['blocked','working','done','idle','unknown'].includes(status)?status:'unknown')+')';
const remembered=()=>{try{return localStorage.getItem(STORAGE_KEY)}catch{return null}};
const remember=(id)=>{try{localStorage.setItem(STORAGE_KEY,id)}catch{}};
const requested=()=>new URL(location.href).searchParams.get('instance');
const nodeOrigin=(node)=>new URL('https://'+node.publicHost+'/').origin;
const selectedNode=()=>nodes.find((node)=>node.id===selectedId)||null;
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

function releaseFrame(id,allowSelected=false){
 if(!allowSelected&&id===selectedId)return false;
 const entry=frameRegistry.get(id);if(!entry)return false;
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
 });
 frameStage.prepend(value);frameRegistry.set(entry.id,entry);return entry;
}

function ensureFrame(node){
 const origin=nodeOrigin(node);let entry=frameRegistry.get(node.id);
 if(entry&&entry.origin!==origin){releaseFrame(node.id,true);entry=null}
 return entry||makeFrame(node);
}

function showOnlyFrame(entry){
 for(const resident of frameRegistry.values())resident.frame.hidden=resident!==entry;
 empty.hidden=true;loading.hidden=!entry.loading;
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

function chooseNode(){
 const candidates=[selectedId,requested(),remembered()];
 for(const id of candidates){const match=nodes.find((node)=>node.id===id);if(match)return match}
 return nodes.find((node)=>node.health==='online')||nodes[0]||null;
}

const treeKey=(nodeId,session,kind,id)=>[nodeId,session,kind,id].join('|');

function toggleTree(key){
 if(expandedTreeKeys.has(key))expandedTreeKeys.delete(key);else expandedTreeKeys.add(key);
 renderTabs();const target=[...instances.querySelectorAll('[data-tree-key]')].find((entry)=>entry.dataset.treeKey===key);if(target)target.focus();
}

function disclosureRow(level,key,label,expanded,options={}){
 const button=element('button','tree-row tree-row-level-'+level);button.type='button';button.dataset.treeKey=key;
 button.setAttribute('role','treeitem');button.setAttribute('aria-level',String(level));button.setAttribute('aria-expanded',String(expanded));
 if(options.stale)button.dataset.stale='true';
 const chevron=element('span','tree-chevron','›');chevron.setAttribute('aria-hidden','true');
 const name=element('span','tree-label',label);button.append(chevron,name);
 if(options.hint)button.append(element('span','tree-hint',options.hint));
 button.addEventListener('click',()=>toggleTree(key));return button;
}

function paneLabel(pane){
 if(pane.label)return pane.label;
 if(pane.kind==='agent'&&pane.agent)return pane.agent;
 const suffix=String(pane.paneId).split(':').pop();return 'Pane '+(suffix||pane.paneId);
}

function renderTabs(focusSelected=false){
 instances.replaceChildren();const liveKeys=new Set();
 const route=activeEntry()?.route||requestedRoute();
 for(const node of nodes){
   const hostKey=treeKey(node.id,'','host',node.id);liveKeys.add(hostKey);
   if(!initializedHostKeys.has(hostKey)){initializedHostKeys.add(hostKey);expandedTreeKeys.add(hostKey)}
   const wrapper=element('div','host-tree');wrapper.setAttribute('role','none');
   const button=element('button','instance-tab tree-row tree-row-level-1');
   button.type='button';button.setAttribute('role','treeitem');button.setAttribute('aria-level','1');button.setAttribute('aria-expanded',String(expandedTreeKeys.has(hostKey)));
   button.dataset.instance=node.id;button.dataset.treeKey=hostKey;button.dataset.health=node.health;
   button.setAttribute('aria-selected',String(node.id===selectedId));button.setAttribute('aria-label',node.name+' · '+healthLabel(node.health));
   const chevron=element('span','tree-chevron','›');chevron.setAttribute('aria-hidden','true');
   const dot=element('span','status-dot');dot.setAttribute('aria-hidden','true');
   const label=element('span','instance-name tree-label',node.name);button.append(chevron,dot,label);
   button.addEventListener('click',()=>{
     if(desktopMedia.matches){if(expandedTreeKeys.has(hostKey))expandedTreeKeys.delete(hostKey);else expandedTreeKeys.add(hostKey)}
     selectNode(node.id,{focusTreeKey:hostKey});
   });
   const hostChildren=element('div','tree-children');hostChildren.setAttribute('role','group');hostChildren.hidden=!expandedTreeKeys.has(hostKey);
   const trees=Array.isArray(node.treeSessions)?node.treeSessions:[];
   for(const tree of trees){
     const session=typeof tree.herdrSession==='string'?tree.herdrSession:'';const sessionHint=trees.length>1&&!tree.primarySession?session:'';
     for(const space of Array.isArray(tree.spaces)?tree.spaces:[]){
       const spaceId=validPane(space.workspaceId);if(!spaceId)continue;
       const spaceKey=treeKey(node.id,session,'space',spaceId);liveKeys.add(spaceKey);
       const spaceOpen=expandedTreeKeys.has(spaceKey);
       const spaceRow=disclosureRow(2,spaceKey,space.label||'Space '+space.number,spaceOpen,{stale:!tree.reachable,hint:sessionHint});
       const spaceChildren=element('div','tree-children');spaceChildren.setAttribute('role','group');spaceChildren.hidden=!spaceOpen;
       for(const tab of Array.isArray(space.tabs)?space.tabs:[]){
         const tabId=validPane(tab.tabId);if(!tabId)continue;
         const tabKey=treeKey(node.id,session,'tab',tabId);liveKeys.add(tabKey);
         const tabOpen=expandedTreeKeys.has(tabKey);
         const tabRow=disclosureRow(3,tabKey,tab.label||'Tab '+tab.number,tabOpen,{stale:!tree.reachable});
         const tabChildren=element('div','tree-children');tabChildren.setAttribute('role','group');tabChildren.hidden=!tabOpen;
         for(const pane of Array.isArray(tab.panes)?tab.panes:[]){
           const paneId=validPane(pane.paneId);if(!paneId)continue;
           const paneKey=treeKey(node.id,session,'pane',paneId);liveKeys.add(paneKey);
           const paneRow=element('button','tree-row tree-row-level-4 pane-tree-row');paneRow.type='button';paneRow.dataset.treeKey=paneKey;
           paneRow.setAttribute('role','treeitem');paneRow.setAttribute('aria-level','4');paneRow.dataset.stale=String(!tree.reachable);
           const selected=node.id===selectedId&&route.view==='pane'&&route.paneId===paneId&&(route.session||'')===(tree.primarySession?'':session);
           paneRow.setAttribute('aria-selected',String(selected));
           const paneState=pane.kind==='shell'?'shell':statusLabel(pane.status);const paneDot=element('span','tree-pane-dot');
           paneDot.style.setProperty('--tree-pane-color',pane.kind==='shell'?'var(--status-idle)':statusColor(pane.status));paneDot.setAttribute('aria-hidden','true');
           paneRow.append(paneDot,element('span','tree-label',paneLabel(pane)),element('span','tree-hint',paneState));
           paneRow.addEventListener('click',()=>selectNode(node.id,{route:{view:'pane',spaceId,tabId,paneId,...(!tree.primarySession&&session?{session}:{})},focusTreeKey:paneKey}));
           tabChildren.append(paneRow);
         }
         spaceChildren.append(tabRow,tabChildren);
       }
       hostChildren.append(spaceRow,spaceChildren);
     }
   }
   wrapper.append(button,hostChildren);instances.append(wrapper);
 }
 for(const key of [...expandedTreeKeys]){if(!liveKeys.has(key))expandedTreeKeys.delete(key)}
 const focusKey=focusSelected&&typeof focusSelected==='string'?focusSelected:null;
 const active=focusKey?[...instances.querySelectorAll('[data-tree-key]')].find((entry)=>entry.dataset.treeKey===focusKey):instances.querySelector('[data-instance][aria-selected="true"]');
 if(active){active.scrollIntoView({block:'nearest',inline:'nearest'});if(focusSelected)active.focus()}
}

function updateHealth(node){
 const healthy=node.health==='online';
 notice.hidden=healthy;
 if(!healthy){const detail=node.message?' · '+node.message:'';noticeText.textContent=node.name+' · '+healthLabel(node.health)+detail}
}

function loadSelected(force=false,routeOverride=null){
 const node=selectedNode();if(!node)return;
 const entry=ensureFrame(node);let route=routeOverride||entry.route||{view:'home'};
 if(route.invalid)route={view:'home'};
 else if(route.view==='pane')route=canonicalPaneRoute(route.paneId,route.session,route.spaceId,route.tabId);
 const href=frameHref(entry.origin,route);const nextFrameKey=routeKey(entry.origin,route);
 entry.route=route;entry.frame.title='Collie · '+node.name;
 openNode.href=href;openNode.hidden=false;updateHealth(node);
 if(force||entry.frameKey!==nextFrameKey){entry.frameKey=nextFrameKey;entry.loading=true;entry.frame.src=href}
 showOnlyFrame(entry);replaceUrl(node.id,route);
}

function selectNode(id,options={}){
 const node=nodes.find((candidate)=>candidate.id===id);if(!node)return;
 const existing=frameRegistry.get(id);
 const supplied=options.route&&options.route.view==='pane'?options.route:null;
 let route=supplied||(options.routeFromUrl?requestedRoute():existing?.route||{view:'home'});
 selectedId=id;remember(id);
 const entry=ensureFrame(node);
 route=route.invalid?{view:'home'}:route.view==='pane'?canonicalPaneRoute(route.paneId,route.session,route.spaceId,route.tabId):route;
 entry.route=route;visitFrame(entry);replaceUrl(id,route);
 renderTabs(options.focusTreeKey||Boolean(options.focusTab));
 loadSelected(Boolean(options.forceFrame),route);
 announce('Selected '+node.name+'. '+healthLabel(node.health)+'.');
}

function showEmpty(title,copy){
 for(const id of [...frameRegistry.keys()])releaseFrame(id,true);
 selectedId=null;instances.replaceChildren();openNode.hidden=true;notice.hidden=true;loading.hidden=true;
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
 if(key==='needs'||key==='ready'||key==='working')copy.sort((a,b)=>(b.agent.lastActiveAt||0)-(a.agent.lastActiveAt||0));
 else copy.sort((a,b)=>(b.agent.lastSeenAt||0)-(a.agent.lastSeenAt||0));
 return copy;
}

function selectAgent(node,agent){
 const spaceId=validPane(agent.workspaceId);const tabId=validPane(agent.tabId);const paneId=validPane(agent.paneId);const session=agent.primarySession?null:validSession(agent.herdrSession);
 if(!spaceId||!tabId||!paneId||(!agent.primarySession&&!session))return;
 closeAgentMenu();
 selectNode(node.id,{route:{view:'pane',spaceId,tabId,paneId,...(session?{session}:{})}});
}

function renderAgentCard(node,agent){
 const parts=agentParts(agent);
 const card=element('button','agent-card');card.type='button';card.dataset.live=String(Boolean(agent.reachable));card.dataset.status=agent.status;
 card.setAttribute('aria-label',(agent.reachable?'':'Offline · ')+node.name+' · '+parts.project+(parts.tab?' · '+parts.tab:'')+' · '+statusLabel(agent.status));
 const avatar=element('span','agent-avatar',initials(agent.agent));avatar.dataset.brand=brand(agent.agent);avatar.setAttribute('aria-hidden','true');
 const dot=element('span','agent-status-dot');dot.style.setProperty('--agent-status-color',statusColor(agent.status));avatar.append(dot);
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
 copy.append(title,meta);card.append(avatar,copy);card.addEventListener('click',()=>selectAgent(node,agent));return card;
}

function renderAgents(){
 agentSections.replaceChildren();
 const entries=[];
 for(const node of nodes){for(const agent of Array.isArray(node.agentEntries)?node.agentEntries:[])entries.push({node,agent})}
 const live=entries.filter(({agent})=>agent.reachable).length;
 const offline=entries.length-live;
 const counted=entries.filter(({agent})=>bucket(agent)!=='recent').length;
 agentMenuCount.textContent=String(counted);
 agentMenuToggle.title='All Agents · '+counted+' outside Recent';
 agentMenuToggle.setAttribute('aria-label','Open all Agents · '+counted+' outside Recent · '+live+' live'+(offline?' · '+offline+' offline':''));
 if(!entries.length){agentSections.append(element('p','agent-empty','No agents running.'));return}
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
   for(const entry of matching)list.append(renderAgentCard(entry.node,entry.agent));
   wrapper.append(heading,list);agentSections.append(wrapper);
 }
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

function closeAgentMenu(){if(desktopMedia.matches)return;agentMenu.hidden=true;agentMenuToggle.setAttribute('aria-expanded','false')}

function openAgentMenu(){
 agentMenu.hidden=false;agentMenuToggle.setAttribute('aria-expanded','true');renderAgents();
 void refresh({manual:true});
}

function syncAgentMenuLayout(){
 const nextDesktop=desktopMedia.matches;
 if(nextDesktop){agentMenu.hidden=false;agentMenuToggle.setAttribute('aria-expanded','false');renderAgents()}
 else if(desktopMode){agentMenu.hidden=true;agentMenuToggle.setAttribute('aria-expanded','false')}
 desktopMode=nextDesktop;
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

instances.addEventListener('keydown',(event)=>{
 if(desktopMedia.matches||!event.target.closest('[data-instance]'))return;
 if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
 const index=nodes.findIndex((node)=>node.id===selectedId);if(index<0)return;
 event.preventDefault();const delta=event.key==='ArrowRight'?1:-1;const next=nodes[(index+delta+nodes.length)%nodes.length];if(next)selectNode(next.id,{focusTab:true});
});
agentMenuToggle.addEventListener('click',()=>{if(agentMenu.hidden)openAgentMenu();else closeAgentMenu()});
document.addEventListener('pointerdown',(event)=>{if(!desktopMedia.matches&&!agentMenu.hidden&&!agentMenu.contains(event.target)&&!agentMenuToggle.contains(event.target))closeAgentMenu()});
document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&!desktopMedia.matches&&!agentMenu.hidden){closeAgentMenu();agentMenuToggle.focus()}});
addEventListener('message',(event)=>{
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
 replaceUrl(entry.id,route);openNode.href=frameHref(entry.origin,route);renderTabs();
});
document.querySelector('#retry-frame').addEventListener('click',()=>loadSelected(true));
document.querySelector('#retry-inventory').addEventListener('click',()=>refresh({manual:true}));
addEventListener('popstate',()=>{const id=requested();if(nodes.some((node)=>node.id===id))selectNode(id,{routeFromUrl:true})});
desktopMedia.addEventListener('change',syncAgentMenuLayout);syncAgentMenuLayout();
void refresh();
`;
