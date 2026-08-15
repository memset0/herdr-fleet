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

export function nextFleetRefreshDelay(
  currentMs: number,
  baseMs: number,
  maxMs: number,
  options: { manual: boolean; unchanged: boolean },
): number {
  if (options.manual || !options.unchanged) return baseMs;
  return Math.min(Math.max(currentMs, baseMs) * 2, maxMs);
}

interface FleetAgentTriageInput {
  reachable: boolean;
  status: string;
  lastActiveAt?: number;
  lastSeenAt?: number;
}

export function fleetAgentBucket(
  agent: FleetAgentTriageInput,
): "needs" | "ready" | "working" | "recent" | "offline" {
  if (!agent.reachable) return "offline";
  if (agent.status === "blocked") return "needs";
  if (agent.status === "done" && (agent.lastActiveAt ?? 0) > (agent.lastSeenAt ?? 0)) return "ready";
  if (agent.status === "working") return "working";
  return "recent";
}

export function fleetHeaderAgentCount(agents: readonly FleetAgentTriageInput[]): number {
  return agents.filter((agent) => fleetAgentBucket(agent) !== "recent").length;
}

export function fleetPage(): string {
  return documentShell(
    "Fleet · Collie",
    `<main class="fleet-shell">
      <header class="fleet-header">
        <a class="fleet-mark" href="/" aria-label="Fleet home" title="Herdr Fleet">H</a>
        <nav id="instances" class="instance-strip" aria-label="Herdr instances" role="tablist">
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
      <section id="agent-menu" class="agent-menu" role="dialog" aria-modal="false" aria-label="Agents across all Hosts" hidden>
        <div class="agent-menu-heading">
          <div>
            <p class="agent-menu-eyebrow">FLEET</p>
            <h1>All Agents</h1>
          </div>
          <span id="agent-refresh-state" class="agent-refresh-state" role="status">Refreshing…</span>
        </div>
        <div id="agent-sections" class="agent-sections"></div>
      </section>
      <section id="frame-stage" class="frame-stage" aria-live="polite">
        <iframe id="node-frame" class="node-frame" title="Selected Collie instance" allow="clipboard-read; clipboard-write" hidden></iframe>
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
  max-width: 640px;
  margin: 0 auto;
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
@media (prefers-reduced-motion: reduce) {
  .loading-mark { animation: none; }
  .agent-card { transition: none; }
}
`;

export const FLEET_JS = `
const STORAGE_KEY='herdr-web-remote:selected-instance';
const ROUTE_MESSAGE='herdr-web-remote:route';
const DEFAULT_REFRESH_MS=5000;
const DEFAULT_MAX_REFRESH_MS=3600000;
const instances=document.querySelector('#instances');
const frame=document.querySelector('#node-frame');
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
let nodes=[];
let selectedId=null;
let currentOrigin=null;
let currentFrameKey=null;
let refreshing=false;
let queuedManualRefresh=false;
let refreshTimer=null;
let refreshBaseMs=DEFAULT_REFRESH_MS;
let refreshMaxMs=DEFAULT_MAX_REFRESH_MS;
let refreshDelayMs=DEFAULT_REFRESH_MS;
let lastRevision=null;

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
 const rawPane=params.get('pane');const rawSession=params.get('session');
 const paneId=validPane(rawPane);const session=validSession(rawSession);
 return {view:paneId?'pane':'home',...(paneId?{paneId}:{}),...(session?{session}:{}),invalid:(rawPane!==null&&!paneId)||(rawSession!==null&&!session)};
}

const routeKey=(origin,route)=>origin+'|'+route.view+'|'+(route.paneId||'')+'|'+(route.session||'');

function frameHref(origin,route){
 const url=new URL('/',origin);
 if(route.view==='pane')url.pathname='/pane/'+encodeURIComponent(route.paneId);
 if(route.session)url.searchParams.set('s',route.session);
 return url.href;
}

function replaceUrl(id,route){
 const url=new URL(location.href);
 url.searchParams.set('instance',id);
 url.searchParams.delete('pane');url.searchParams.delete('session');
 if(route.view==='pane')url.searchParams.set('pane',route.paneId);
 if(route.session)url.searchParams.set('session',route.session);
 if(url.href===location.href)return;
 history.replaceState(null,'',url);
}

function chooseNode(){
 const candidates=[selectedId,requested(),remembered()];
 for(const id of candidates){const match=nodes.find((node)=>node.id===id);if(match)return match}
 return nodes.find((node)=>node.health==='online')||nodes[0]||null;
}

function renderTabs(focusSelected=false){
 instances.replaceChildren();
 for(const node of nodes){
   const button=element('button','instance-tab');
   button.type='button';button.setAttribute('role','tab');button.dataset.instance=node.id;button.dataset.health=node.health;
   button.setAttribute('aria-selected',String(node.id===selectedId));
   button.setAttribute('aria-label',node.name+' · '+healthLabel(node.health));
   const dot=element('span','status-dot');dot.setAttribute('aria-hidden','true');
   const label=element('span','instance-name',node.name);
   button.append(dot,label);
   button.addEventListener('click',()=>selectNode(node.id,{resetRoute:true}));
   instances.append(button);
 }
 const active=instances.querySelector('[aria-selected="true"]');
 if(active){active.scrollIntoView({block:'nearest',inline:'nearest'});if(focusSelected)active.focus()}
}

function updateHealth(node){
 const healthy=node.health==='online';
 notice.hidden=healthy;
 if(!healthy){const detail=node.message?' · '+node.message:'';noticeText.textContent=node.name+' · '+healthLabel(node.health)+detail}
}

function loadSelected(force=false){
 const node=selectedNode();if(!node)return;
 const origin=nodeOrigin(node);
 let route=requestedRoute();
 if(route.invalid){route={view:'home'};replaceUrl(node.id,route)}
 const href=frameHref(origin,route);const nextFrameKey=routeKey(origin,route);
 openNode.href=href;openNode.hidden=false;
 frame.title='Collie · '+node.name;
 frame.hidden=false;empty.hidden=true;updateHealth(node);
 if(force||currentFrameKey!==nextFrameKey){currentOrigin=origin;currentFrameKey=nextFrameKey;loading.hidden=false;frame.src=href}
}

function selectNode(id,options={}){
 const node=nodes.find((candidate)=>candidate.id===id);if(!node)return;
 const changed=selectedId!==id;
 const supplied=options.route&&options.route.view==='pane'?options.route:null;
 const route=supplied||(options.resetRoute?{view:'home'}:requestedRoute());
 selectedId=id;remember(id);replaceUrl(id,route.invalid?{view:'home'}:route);
 renderTabs(Boolean(options.focusTab));
 loadSelected(Boolean(options.forceFrame)||changed||Boolean(options.resetRoute));
 announce('Selected '+node.name+'. '+healthLabel(node.health)+'.');
}

function showEmpty(title,copy){
 selectedId=null;currentOrigin=null;currentFrameKey=null;instances.replaceChildren();openNode.hidden=true;notice.hidden=true;loading.hidden=true;frame.hidden=true;frame.removeAttribute('src');
 emptyTitle.textContent=title;emptyCopy.textContent=copy;empty.hidden=false;announce(title+'. '+copy);
}

function agentParts(agent){
 const project=agent.workspaceLabel||agent.workspaceId;
 const own=agent.paneLabel||agent.sessionName||'';
 const cwd=!agent.cwd||baseName(agent.cwd).toLowerCase()===String(project).trim().toLowerCase()?'':shortCwd(agent.cwd);
 return {project,tab:agent.tabLabel||'',secondary:own||cwd};
}

function bucket(agent){
 if(!agent.reachable)return'offline';
 if(agent.status==='blocked')return'needs';
 if(agent.status==='done'&&(agent.lastActiveAt||0)>(agent.lastSeenAt||0))return'ready';
 if(agent.status==='working')return'working';
 return'recent';
}

function sortAgentEntries(key,entries){
 const copy=[...entries];
 if(key==='needs'||key==='ready'||key==='working')copy.sort((a,b)=>(b.agent.lastActiveAt||0)-(a.agent.lastActiveAt||0));
 else if(key==='recent')copy.sort((a,b)=>(b.agent.lastSeenAt||0)-(a.agent.lastSeenAt||0));
 else copy.sort((a,b)=>b.agent.observedAt-a.agent.observedAt);
 return copy;
}

function selectAgent(node,agent){
 const paneId=validPane(agent.paneId);const session=agent.primarySession?null:validSession(agent.herdrSession);
 if(!paneId||(!agent.primarySession&&!session))return;
 closeAgentMenu();
 selectNode(node.id,{route:{view:'pane',paneId,...(session?{session}:{})}});
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
   {key:'offline',label:'Offline',color:'var(--status-blocked)'},
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
 renderAgents();
 if(!nodes.length){showEmpty('No instances','No enabled Herdr instances are configured.');return}
 const choice=chooseNode();
 if(!choice){showEmpty('No instances','No enabled Herdr instances are configured.');return}
 if(choice.id!==selectedId)selectNode(choice.id,{resetRoute:requested()!==choice.id});
 else{renderTabs();loadSelected(false)}
}

function closeAgentMenu(){agentMenu.hidden=true;agentMenuToggle.setAttribute('aria-expanded','false')}

function openAgentMenu(){
 agentMenu.hidden=false;agentMenuToggle.setAttribute('aria-expanded','true');renderAgents();
 void refresh({manual:true});
}

function clearRefreshTimer(){if(refreshTimer!==null){clearTimeout(refreshTimer);refreshTimer=null}}
function scheduleRefresh(){
 clearRefreshTimer();agentRefreshState.textContent='Next refresh in '+formatDelay(refreshDelayMs);
 refreshTimer=setTimeout(()=>{refreshTimer=null;void refresh()},refreshDelayMs);
}

async function refresh(options={}){
 const manual=Boolean(options.manual);
 if(manual){clearRefreshTimer();refreshDelayMs=refreshBaseMs}
 if(refreshing){if(manual)queuedManualRefresh=true;return}
 refreshing=true;agentRefreshState.textContent='Refreshing…';
 try{
   const response=await fetch('/api/fleet',{headers:{accept:'application/json'},cache:'no-store'});
   if(response.status===401){location.assign('/auth/login?next='+encodeURIComponent(location.href));return}
   if(!response.ok)throw new Error('HTTP '+response.status);
   const data=await response.json();
   const nextBase=data.refresh&&Number.isSafeInteger(data.refresh.baseMs)?data.refresh.baseMs:DEFAULT_REFRESH_MS;
   const nextMax=data.refresh&&Number.isSafeInteger(data.refresh.maxMs)?data.refresh.maxMs:DEFAULT_MAX_REFRESH_MS;
   refreshBaseMs=Math.max(1000,nextBase);refreshMaxMs=Math.max(refreshBaseMs,nextMax);
   const revision=Number.isSafeInteger(data.revision)?data.revision:null;
   const unchanged=lastRevision!==null&&revision!==null&&revision===lastRevision;
   lastRevision=revision;renderInventory(data);
   refreshDelayMs=manual?refreshBaseMs:unchanged?Math.min(Math.max(refreshDelayMs,refreshBaseMs)*2,refreshMaxMs):refreshBaseMs;
 }catch(error){
   const message=error instanceof Error?error.message:String(error);
   if(!nodes.length)showEmpty('Fleet unavailable','Could not load instance inventory. '+message);
   announce('Fleet refresh failed. '+message);
   refreshDelayMs=manual?refreshBaseMs:Math.min(Math.max(refreshDelayMs,refreshBaseMs)*2,refreshMaxMs);
 }finally{
   refreshing=false;
   if(queuedManualRefresh){queuedManualRefresh=false;void refresh({manual:true});return}
   scheduleRefresh();
 }
}

instances.addEventListener('keydown',(event)=>{
 if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
 const index=nodes.findIndex((node)=>node.id===selectedId);if(index<0)return;
 event.preventDefault();const delta=event.key==='ArrowRight'?1:-1;const next=nodes[(index+delta+nodes.length)%nodes.length];if(next)selectNode(next.id,{focusTab:true,resetRoute:true});
});
agentMenuToggle.addEventListener('click',()=>{if(agentMenu.hidden)openAgentMenu();else closeAgentMenu()});
document.addEventListener('pointerdown',(event)=>{if(!agentMenu.hidden&&!agentMenu.contains(event.target)&&!agentMenuToggle.contains(event.target))closeAgentMenu()});
document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&!agentMenu.hidden){closeAgentMenu();agentMenuToggle.focus()}});
frame.addEventListener('load',()=>{loading.hidden=true;const node=selectedNode();if(node)announce(node.name+' Collie loaded.')});
addEventListener('message',(event)=>{
 if(event.source!==frame.contentWindow||event.origin!==currentOrigin)return;
 const data=event.data;
 if(!data||typeof data!=='object'||data.type!==ROUTE_MESSAGE||data.version!==1)return;
 if(Object.keys(data).some((key)=>!['type','version','view','paneId','session'].includes(key)))return;
 const hasSession=Object.prototype.hasOwnProperty.call(data,'session');
 const session=hasSession?validSession(data.session):null;
 if(hasSession&&!session)return;
 let route;
 if(data.view==='home'){
   if(Object.prototype.hasOwnProperty.call(data,'paneId'))return;
   route={view:'home',...(session?{session}:{})};
 }else if(data.view==='pane'){
   const paneId=validPane(data.paneId);if(!paneId)return;
   route={view:'pane',paneId,...(session?{session}:{})};
 }else return;
 if(!selectedId||!currentOrigin)return;
 replaceUrl(selectedId,route);currentFrameKey=routeKey(currentOrigin,route);openNode.href=frameHref(currentOrigin,route);
});
document.querySelector('#retry-frame').addEventListener('click',()=>loadSelected(true));
document.querySelector('#retry-inventory').addEventListener('click',()=>refresh({manual:true}));
addEventListener('popstate',()=>{const id=requested();if(nodes.some((node)=>node.id===id))selectNode(id)});
void refresh();
`;
