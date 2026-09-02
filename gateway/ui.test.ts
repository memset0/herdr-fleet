import { describe, expect, test } from "bun:test";

import {
  FLEET_AGENT_FAVORITES_MAX,
  FLEET_CSS,
  FLEET_JS,
  fleetAgentFavoriteCompare,
  fleetAgentFavoriteKey,
  fleetAgentFavoritePreference,
  fleetAttentionResetEligible,
  fleetAgentBucket,
  fleetCloseAffectsRoute,
  fleetCurrentAgentMatch,
  fleetDesktopTerminalUrl,
  fleetFrameActivityActive,
  fleetHeaderAgentCount,
  fleetIframeCacheQuietExpired,
  fleetIframeEvictionCandidate,
  fleetIframeCachePreference,
  fleetPage,
  fleetRailResize,
  fleetRailWidthPreferences,
  fleetRailWidths,
  fleetRefreshWaitMs,
  fleetShortcutCycleIndex,
  fleetTreeTabMode,
} from "./fleet-ui.ts";
import {
  FLEET_COMMANDS,
  parseFleetShortcutDocument,
  publicFleetShortcutDocument,
} from "../shared/fleet-commands.ts";

describe("Fleet iframe shell", () => {
  test("renders a lazy frame stage, responsive Host tree, and reused Agent surface", () => {
    const page = fleetPage(1, "2.4.1");
    expect(page).not.toContain("<iframe");
    expect(page).toContain('data-iframe-cache-size="1"');
    expect(page).toContain('data-plugin-version="2.4.1"');
    expect(page).toContain('aria-label="Web Remote version 2.4.1"');
    expect(page).toContain('id="host-rail-footer"');
    expect(page).toContain('id="fleet-settings-toggle"');
    expect(page).toContain('data-icon="settings"');
    expect(page).toContain('d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0');
    expect(page).toContain('<circle cx="12" cy="12" r="3"></circle>');
    expect(page).not.toContain('d="M12 15.5a3.5 3.5 0 1 0 0-7');
    expect(page).not.toContain('d="M19.4 15a1.7 1.7 0 0 0 .34 1.88');
    expect(page).toContain('id="fleet-settings"');
    expect(page).toContain('id="iframe-cache-size"');
    expect(page).toContain('id="iframe-cache-reset"');
    expect(page).toContain('Default: 1');
    expect(fleetPage(1, '<script>alert("x")</script>')).toContain('data-plugin-version="unknown"');
    expect(fleetPage(5)).toContain('data-iframe-cache-size="5"');
    expect(fleetPage(99)).toContain('data-iframe-cache-size="1"');
    expect(page).toContain('id="host-switcher"');
    expect(page).toContain('aria-label="Herdr Host switcher"');
    expect(page).toContain('role="tablist"');
    expect(page).toContain('id="instances"');
    expect(page).toContain('role="tree"');
    expect(page).toContain('aria-label="Herdr Hosts"');
    expect(page).toContain('id="tree-menu-toggle"');
    expect(page).toContain('aria-controls="instances"');
    expect(page).toContain('id="tree-menu-backdrop"');
    expect(page).toContain('class="fleet-mark fleet-home-mark"');
    expect(page).not.toContain('class="rail-title"');
    expect(page).not.toContain('>Hosts<');
    expect(page).toContain('id="agent-menu-toggle"');
    expect(page).toContain('aria-haspopup="dialog"');
    expect(page).toContain('id="agent-menu"');
    expect(page.indexOf('id="agent-menu"')).toBeLessThan(page.indexOf('id="frame-stage"'));
    expect(page).toContain('id="open-node"');
    expect(page).toContain('id="host-rail-resizer"');
    expect(page).toContain('id="agent-rail-resizer"');
    expect(page).toContain('role="separator"');
    expect(page).toContain('aria-controls="host-rail"');
    expect(page).toContain('aria-controls="agent-menu"');
    expect(page).toContain('data-icon="agent"');
    expect(page).toContain('data-icon="external-link"');
    expect(page).toContain('d="M15 3h6v6"');
    expect(page).not.toContain("agent-menu-glyph");
    expect(page).not.toContain("/auth/logout");
    expect(page).not.toContain("logout-form");
    expect(page).not.toContain("Sign out");
    expect(page).not.toContain("Emergency terminal");
    expect(page).not.toContain(">↗</a>");
    expect(page).toContain('id="retry-frame"');
    expect(page).not.toContain("Fleet totals");
    expect(page).not.toContain('class="node-grid"');
    expect(FLEET_CSS).not.toMatch(/\.fleet-shell\s*\{[^}]*max-width:\s*640px/);
    expect(FLEET_CSS).toMatch(/height:\s*100dvh/);
    expect(FLEET_CSS).toMatch(/html, body \{ height: 100%; overflow: hidden/);
    expect(FLEET_CSS).toMatch(/\.agent-sections \{[^}]*overflow-y: auto/);
    expect(FLEET_CSS).toMatch(/\.frame-stage \{[^}]*min-height: 0;[^}]*overflow: hidden/);
    expect(FLEET_CSS).toMatch(/\.node-frame \{[^}]*width: 100%;[^}]*height: 100%;[^}]*border: 0/);
    expect(FLEET_CSS).toMatch(/\.agent-menu-toggle \{[^}]*grid-template-columns: auto auto/);
    expect(FLEET_CSS).toMatch(/\.agent-menu-count \{[^}]*color: currentColor/);
    expect(FLEET_CSS).not.toMatch(/\.agent-menu-count \{[^}]*position: absolute/);
    expect(FLEET_CSS).toContain("@media (min-width: 1200px)");
    expect(FLEET_CSS).toContain('grid-template-areas: "hosts frame agents"');
    expect(FLEET_CSS).toContain("var(--fleet-host-rail-width) minmax(40rem, 1fr) var(--fleet-agent-rail-width)");
    expect(FLEET_CSS).toMatch(/@media \(min-width: 1200px\)[\s\S]*?\.fleet-header \{[^}]*flex-direction: column/);
    expect(FLEET_CSS).toMatch(/#open-node \{[^}]*position: absolute;[^}]*top: 1rem;[^}]*right: \.75rem/);
    expect(FLEET_CSS).toMatch(/\.agent-menu-heading > div \{ display: none; \}/);
    expect(FLEET_CSS).toMatch(/\.agent-sections \{ order: 1; flex: 1; \}/);
    expect(FLEET_CSS).toContain('.fleet-shell[data-resizing="true"] .node-frame { pointer-events: none; }');
    expect(FLEET_CSS).toContain(".tree-row-level-4");
    expect(FLEET_CSS).toContain('@media (max-width: 1199px)');
    expect(FLEET_CSS).toMatch(/\.host-switcher \{[^}]*display: flex;[^}]*gap: \.3rem;[^}]*overflow-x: auto;[^}]*padding: 0 \.1rem/);
    expect(FLEET_CSS).toMatch(/\.instance-strip \{ display: none; min-width: 0; \}/);
    expect(FLEET_CSS).toMatch(/@media \(max-width: 1199px\)[\s\S]*?\.instance-strip \{[^}]*position: fixed;[^}]*overflow-y: auto/);
    expect(FLEET_CSS).toContain('.fleet-shell[data-tree-open="true"] .instance-strip .instance-tab {');
    expect(FLEET_CSS).not.toContain('.fleet-shell[data-tree-open="true"] .instance-tab {');
    expect(FLEET_CSS).toMatch(/@media \(max-width: 1199px\)[\s\S]*?\.instance-strip \{[^}]*bottom: calc\(3\.35rem \+ env\(safe-area-inset-bottom\)\)/);
    expect(FLEET_CSS).toMatch(/@media \(max-width: 1199px\)[\s\S]*?\.host-rail-footer \{[^}]*position: fixed;[^}]*display: flex/);
    expect(FLEET_CSS).toMatch(/@media \(max-width: 1199px\)[\s\S]*?\.fleet-settings \{[^}]*bottom: calc\(100% \+ \.5rem\);[^}]*display: block/);
    expect(FLEET_CSS).toMatch(/\.fleet-shell\[data-tree-open="true"\] \.tree-inline-action \{[^}]*display: grid;[^}]*opacity: \.82/);
    expect(FLEET_CSS).toMatch(/\.fleet-shell\[data-tree-open="true"\] \.tree-action-status \{[^}]*position: fixed;[^}]*display: block/);
    expect(FLEET_CSS).toContain('.fleet-tree-toggle { display: none; }');
    expect(FLEET_CSS).toContain('.fleet-home-mark { display: grid; align-self: flex-start; }');
    expect(FLEET_CSS).toMatch(/@media \(min-width: 1200px\)[\s\S]*?\.host-rail-footer \{[^}]*display: flex/);
    expect(FLEET_CSS).toContain('.fleet-settings {');
    expect(FLEET_CSS).toContain('bottom: calc(100% + .5rem)');
  });

  test("derives the terminal entry from Fleet node and current Pane only on desktop", () => {
    expect(fleetDesktopTerminalUrl(true, "https://fleet.example.com", "local")).toBe(
      "https://fleet.example.com/ttyd/local/",
    );
    expect(fleetDesktopTerminalUrl(true, "https://fleet.example.com", "local", "w1:p1", "batch-a")).toBe(
      "https://fleet.example.com/ttyd/local/?pane=w1%3Ap1&session=batch-a",
    );
    expect(fleetDesktopTerminalUrl(false, "https://fleet.example.com", "local")).toBeNull();
    expect(fleetDesktopTerminalUrl(true, "http://fleet.example.com", "local")).toBeNull();
    expect(fleetDesktopTerminalUrl(true, "https://operator:secret@fleet.example.com", "local")).toBeNull();
    expect(fleetDesktopTerminalUrl(true, "https://fleet.example.com", "../other")).toBeNull();
    expect(fleetDesktopTerminalUrl(true, "https://fleet.example.com", "local", "../pane")).toBeNull();
    expect(fleetDesktopTerminalUrl(true, "https://fleet.example.com", "local", "w1:p1", "batch demo")).toBeNull();
    expect(FLEET_CSS).toContain("@media (min-width: 1200px) and (hover: hover) and (pointer: fine)");
    expect(FLEET_JS).toContain("TERMINAL_DESKTOP_MEDIA='(min-width: 1200px) and (hover: hover) and (pointer: fine)'");
    expect(FLEET_JS).toContain("const href=terminalDesktopMedia.matches?terminalHref(node):null");
    expect(FLEET_JS).toContain("new URL('/ttyd/'+encodeURIComponent(node.id)+'/',location.origin)");
    expect(FLEET_JS).toContain("url.searchParams.set('pane',pane)");
    expect(FLEET_JS).toContain("url.searchParams.set('session',session)");
    expect(FLEET_JS).toContain("if(!href){if(link)link.remove();return}");
    expect(FLEET_JS).toContain("element('a','desktop-terminal-entry','Emergency terminal')");
    expect(FLEET_JS).toContain("link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='same-origin'");
    expect(FLEET_JS).toContain("terminalDesktopMedia.addEventListener('change',syncTerminalEntry)");
    const handlerStart = FLEET_JS.indexOf("function syncTerminalEntry()");
    const handlerEnd = FLEET_JS.indexOf("function loadSelected", handlerStart);
    const handler = FLEET_JS.slice(handlerStart, handlerEnd);
    expect(handler).not.toContain("fetch(");
    expect(handler).not.toContain("WebSocket");
    expect(handler).not.toContain("enable");
  });

  test("parses the browser-local cache override and applies runtime shrink semantics", () => {
    expect(fleetIframeCachePreference(null, 5)).toBe(5);
    expect(fleetIframeCachePreference('{"version":1,"size":3}', 5)).toBe(3);
    expect(fleetIframeCachePreference('{"version":2,"size":3}', 5)).toBe(5);
    expect(fleetIframeCachePreference('{"version":1,"size":0}', 5)).toBe(5);
    expect(fleetIframeCachePreference('{"version":1,"size":11}', 5)).toBe(5);
    expect(fleetIframeCachePreference("bad json", 5)).toBe(5);
    expect(fleetIframeCachePreference(null, 99)).toBe(1);

    expect(FLEET_JS).toContain("CACHE_STORAGE_KEY='herdr-web-remote:fleet-iframe-cache:v1'");
    expect(FLEET_JS).toContain("let iframeCacheSize=readIframeCachePreference()");
    expect(FLEET_JS).toContain("localStorage.setItem(CACHE_STORAGE_KEY,JSON.stringify({version:1,size}))");
    expect(FLEET_JS).toContain("localStorage.removeItem(CACHE_STORAGE_KEY)");
    expect(FLEET_JS).toContain("while(frameRegistry.size>iframeCacheSize)");
    expect(FLEET_JS).toContain("setIframeCacheSize(cacheSizeSelect.value)");
    expect(FLEET_JS).toContain("setIframeCacheSize(defaultCacheSize,{persist:false})");
    expect(FLEET_JS).toContain("if(!desktopMedia.matches&&!treeOpen)return false;if(sidebarsCollapsed)setSidebarsCollapsed(false);closeTreeContextMenu();closeCommandDialog();cancelSpaceClose()");
    expect(FLEET_JS).toContain("if(!desktopMedia.matches&&!settingsPopover.hidden)closeSettings()");
    expect(FLEET_JS).toContain("if((desktopMedia.matches||treeOpen)&&!settingsPopover.hidden");
    expect(FLEET_JS).toContain("if(!settingsPopover.hidden){closeSettings({restoreFocus:true});return}");
  });

  test("clamps, resizes, and parses browser-local desktop rail widths", () => {
    expect(fleetRailWidths(null, 1_200)).toEqual({ left: 224, right: 336 });
    expect(fleetRailWidths(null, 1_600)).toEqual({ left: 224, right: 336 });

    const constrained = fleetRailWidths({ left: 9_999, right: 9_999 }, 1_200);
    expect(constrained.left).toBeGreaterThanOrEqual(176);
    expect(constrained.right).toBeGreaterThanOrEqual(256);
    expect(constrained.left + constrained.right).toBeLessThanOrEqual(560);

    expect(fleetRailResize({ left: 224, right: 336 }, "left", 999, 1_200)).toEqual({ left: 224, right: 336 });
    expect(fleetRailResize({ left: 176, right: 256 }, "right", 400, 1_200)).toEqual({ left: 176, right: 384 });
    expect(fleetRailResize({ left: 224, right: 336 }, "left", Number.NaN, 1_600)).toEqual({ left: 224, right: 336 });

    expect(fleetRailWidthPreferences('{"version":1,"left":248,"right":368}')).toEqual({ left: 248, right: 368 });
    expect(fleetRailWidthPreferences('{"version":1,"left":9999,"right":9999}')).toEqual({ left: 9999, right: 9999 });
    expect(fleetRailWidthPreferences('{"version":2,"left":248,"right":368}')).toBeNull();
    expect(fleetRailWidthPreferences('{"version":1,"left":-1,"right":368}')).toBeNull();
    expect(fleetRailWidthPreferences("not json")).toBeNull();
    expect(fleetRailWidthPreferences(null)).toBeNull();

    expect(FLEET_JS).toContain("RAIL_STORAGE_KEY='herdr-web-remote:fleet-rail-widths:v1'");
    expect(FLEET_JS).toContain("localStorage.getItem(RAIL_STORAGE_KEY)");
    expect(FLEET_JS).toContain("localStorage.setItem(RAIL_STORAGE_KEY");
    expect(FLEET_JS).toContain("addEventListener('resize',applyRailWidthPreferences)");
    expect(FLEET_JS).toContain("event.key!=='ArrowLeft'&&event.key!=='ArrowRight'");
    expect(FLEET_JS).toContain("handle.setPointerCapture(event.pointerId)");
    expect(FLEET_JS).toContain("aria-valuetext");
  });

  test("keeps selected and hidden Collie documents in a bounded LRU registry", () => {
    expect(() => new Function(FLEET_JS)).not.toThrow();
    expect(FLEET_JS).toContain("searchParams.get('instance')");
    expect(FLEET_JS).toContain("localStorage.getItem(STORAGE_KEY)");
    expect(FLEET_JS).toContain("history.replaceState");
    expect(FLEET_JS).toContain("const frameRegistry=new Map()");
    expect(FLEET_JS).toContain("while(frameRegistry.size>=iframeCacheSize)");
    expect(FLEET_JS).toContain("entry.frame.src=href");
    expect(FLEET_JS).toContain("resident.frame.hidden=resident!==entry");
    expect(FLEET_JS).toContain("left.lastVisitedAt-right.lastVisitedAt");
    expect(FLEET_JS).toContain("FRAME_CACHE_QUIET_MS=1800000");
    expect(FLEET_JS).toContain("if(id!==selectedId)releaseFrame(id)");
    expect(FLEET_JS).not.toContain("bucket(agent)!=='recent').length&&");
    expect(FLEET_JS).not.toContain("innerHTML");
    expect(FLEET_JS).toContain("textContent=String(text)");
    expect(FLEET_JS).toContain("replaceChildren");
    expect(FLEET_JS).not.toContain("sessionHref");

    expect(fleetIframeEvictionCandidate([
      { id: "selected", lastVisitedAt: 1 },
      { id: "older", lastVisitedAt: 10 },
      { id: "newer", lastVisitedAt: 20 },
    ], "selected")).toBe("older");
    expect(fleetIframeEvictionCandidate([{ id: "selected", lastVisitedAt: 1 }], "selected")).toBeNull();
    expect(fleetIframeCacheQuietExpired(1_800_100, 100)).toBeTrue();
    expect(fleetIframeCacheQuietExpired(1_800_099, 100)).toBeFalse();
  });

  test("activates only the unobscured selected iframe and posts exact-origin state", () => {
    const base = {
      selected: true,
      frameHidden: false,
      documentHidden: false,
      desktop: true,
      treeOpen: false,
      agentMenuHidden: false,
    };
    expect(fleetFrameActivityActive(base)).toBeTrue();
    expect(fleetFrameActivityActive({ ...base, selected: false })).toBeFalse();
    expect(fleetFrameActivityActive({ ...base, frameHidden: true })).toBeFalse();
    expect(fleetFrameActivityActive({ ...base, documentHidden: true })).toBeFalse();
    expect(fleetFrameActivityActive({ ...base, desktop: false, agentMenuHidden: true })).toBeTrue();
    expect(fleetFrameActivityActive({ ...base, desktop: false, agentMenuHidden: false })).toBeFalse();
    expect(fleetFrameActivityActive({ ...base, desktop: false, agentMenuHidden: true, treeOpen: true })).toBeFalse();

    expect(FLEET_JS).toContain("FRAME_ACTIVITY_MESSAGE='herdr-web-remote:activity'");
    expect(FLEET_JS).toContain("FRAME_ACTIVITY_VERSION=1");
    expect(FLEET_JS).toContain("target.postMessage({type:FRAME_ACTIVITY_MESSAGE,version:FRAME_ACTIVITY_VERSION,active:frameActivityActive(entry)},entry.origin)");
    expect(FLEET_JS).toContain("value.addEventListener('load'");
    expect(FLEET_JS).toContain("postFrameActivity(entry)");
    expect(FLEET_JS).toContain("broadcastFrameActivity()");
    expect(FLEET_JS).toContain("document.addEventListener('visibilitychange',()=>{cancelShortcutPrefix();broadcastFrameActivity()})");
    expect(FLEET_JS).not.toContain("contentWindow.document");
  });

  test("renders Collie triage, Host identity, and stale cards through safe DOM nodes", () => {
    expect(FLEET_JS).toContain("{key:'needs',label:'Needs you'");
    expect(FLEET_JS).toContain("{key:'ready',label:'Ready · unseen'");
    expect(FLEET_JS).toContain("{key:'working',label:'Working'");
    expect(FLEET_JS).toContain("{key:'recent',label:'Recent'");
    expect(FLEET_JS).not.toContain("{key:'offline',label:'Offline'");
    expect(FLEET_JS).toContain("element('span','host-chip',node.name)");
    expect(FLEET_JS).toContain("element('span','offline-chip','offline')");
    expect(FLEET_CSS).toContain("--status-blocked:");
    expect(FLEET_CSS).toContain("--status-working:");
    expect(FLEET_CSS).toContain('.agent-card[data-live="false"]');
    expect(FLEET_JS).toContain("Array.isArray(node.treeSessions)?node.treeSessions:[]");
    expect(FLEET_JS).toContain("const expandedTreeKeys=new Set()");
    expect(FLEET_JS).toContain("if(!initializedHostKeys.has(hostKey))");
    expect(FLEET_JS).toContain("pane.kind==='shell'?'shell':statusLabel(pane.status)");
    expect(FLEET_JS).toContain("selectNode(node.id,{route:{view:'pane',spaceId,tabId,paneId");

    expect(fleetAgentBucket({ reachable: true, status: "blocked" })).toBe("needs");
    expect(fleetAgentBucket({ reachable: true, status: "done", lastActiveAt: 2, lastSeenAt: 1 })).toBe("ready");
    expect(fleetAgentBucket({ reachable: true, status: "working" })).toBe("working");
    expect(fleetAgentBucket({ reachable: true, status: "idle" })).toBe("recent");
    expect(fleetAgentBucket({ reachable: false, status: "working" })).toBe("working");
    expect(fleetAgentBucket({ reachable: false, status: "blocked" })).toBe("needs");
    expect(fleetAgentBucket({ reachable: false, status: "idle" })).toBe("recent");

    expect(
      fleetHeaderAgentCount([
        { reachable: true, status: "blocked" },
        { reachable: true, status: "done", lastActiveAt: 2, lastSeenAt: 1 },
        { reachable: true, status: "working" },
        { reachable: false, status: "idle" },
        { reachable: true, status: "idle" },
        { reachable: true, status: "done", lastActiveAt: 1, lastSeenAt: 1 },
      ]),
    ).toBe(3);
    expect(FLEET_JS).toContain("entries.filter(({agent})=>bucket(agent)!=='recent').length");
    expect(FLEET_JS).toContain("outside Recent");
  });

  test("persists bounded browser-local Agent favorites and sorts them first within each bucket", () => {
    const alpha = fleetAgentFavoriteKey({ nodeId: "alpha", herdrSession: "default", paneId: "w0:p1", agent: "codex" });
    const beta = fleetAgentFavoriteKey({ nodeId: "beta", herdrSession: "batch", paneId: "w1:p2", agent: "claude" });
    expect(alpha).toBe('["alpha","default","w0:p1","codex"]');
    expect(beta).toBe('["beta","batch","w1:p2","claude"]');
    expect(fleetAgentFavoriteKey({ nodeId: "", herdrSession: "default", paneId: "w0:p1", agent: "codex" })).toBeNull();
    expect(fleetAgentFavoriteKey({ nodeId: "alpha", herdrSession: "bad\nname", paneId: "w0:p1", agent: "codex" })).toBeNull();

    expect([...fleetAgentFavoritePreference(null)]).toEqual([]);
    expect([...fleetAgentFavoritePreference(JSON.stringify({ version: 1, keys: [alpha!, beta!] }))]).toEqual([alpha!, beta!]);
    expect([...fleetAgentFavoritePreference(JSON.stringify({ version: 1, keys: [alpha!, alpha!] }))]).toEqual([]);
    expect([...fleetAgentFavoritePreference(JSON.stringify({ version: 2, keys: [alpha!] }))]).toEqual([]);
    expect([...fleetAgentFavoritePreference("not json")]).toEqual([]);
    const oversized = Array.from({ length: FLEET_AGENT_FAVORITES_MAX + 1 }, (_, index) =>
      fleetAgentFavoriteKey({ nodeId: "alpha", herdrSession: "default", paneId: `w0:p${index}`, agent: "codex" }),
    );
    expect([...fleetAgentFavoritePreference(JSON.stringify({ version: 1, keys: oversized }))]).toEqual([]);
    const favorites = new Set([beta!]);
    expect(fleetAgentFavoriteCompare(alpha!, beta!, favorites)).toBe(1);
    expect(fleetAgentFavoriteCompare(beta!, alpha!, favorites)).toBe(-1);
    expect(fleetAgentFavoriteCompare(alpha!, alpha!, favorites)).toBe(0);

    expect(FLEET_JS).toContain("AGENT_FAVORITES_STORAGE_KEY='herdr-web-remote:fleet-agent-favorites:v1'");
    expect(FLEET_JS).toContain(`const AGENT_FAVORITES_MAX=${FLEET_AGENT_FAVORITES_MAX}`);
    expect(FLEET_JS).toContain("JSON.stringify([node.id,agent.herdrSession,agent.paneId,agent.agent])");
    expect(FLEET_JS).toContain("localStorage.setItem(AGENT_FAVORITES_STORAGE_KEY,JSON.stringify({version:1,keys:[...agentFavorites]}))");
    expect(FLEET_JS).toContain("if(agentFavorites.size>=AGENT_FAVORITES_MAX)");
    expect(FLEET_JS).toContain("agentFavorites.values().next().value");
    expect(FLEET_JS).toContain("event.key===AGENT_FAVORITES_STORAGE_KEY");
    expect(FLEET_JS).toContain("Number(agentFavorites.has(agentFavoriteKey(b.node,b.agent)))-Number(agentFavorites.has(agentFavoriteKey(a.node,a.agent)))");
    expect(FLEET_JS).toContain("element('div','agent-card')");
    expect(FLEET_JS).toContain("element('button','agent-card-main')");
    expect(FLEET_JS).toContain("element('button','agent-favorite')");
    expect(FLEET_JS).toContain("favorite.setAttribute('aria-pressed',String(isFavorite))");
    expect(FLEET_JS).toContain("const favoriteFocusKey=focusFavoriteKey||document.activeElement?.dataset?.favoriteKey||pendingFavoriteFocusKey");
    expect(FLEET_JS).toContain("if(pendingFavoriteFocusKey===favoriteFocusKey)pendingFavoriteFocusKey=null");
    expect(FLEET_JS).toContain("svg.dataset.icon='star'");
    expect(FLEET_CSS).toContain(".agent-favorite[aria-pressed=\"true\"]");
    expect(FLEET_CSS).toContain(".agent-favorite-icon { width: .95rem; height: .95rem; fill: none; }");

    const toggleStart = FLEET_JS.indexOf("function toggleAgentFavorite(node,agent)");
    const toggleEnd = FLEET_JS.indexOf("function renderAgentCard", toggleStart);
    const toggleSource = FLEET_JS.slice(toggleStart, toggleEnd);
    expect(toggleSource).toContain("persistAgentFavorites();renderAgents(key)");
    expect(toggleSource).not.toContain("selectAgent(");
    expect(toggleSource).not.toContain("selectNode(");
    expect(toggleSource).not.toContain("refresh(");
    expect(toggleSource).not.toContain("fetch(");
  });

  test("renders the complete effective shortcut catalog and unified recognizer metadata", () => {
    expect(fleetShortcutCycleIndex(["a", "b", "c"], "a", -1)).toBe(2);
    expect(fleetShortcutCycleIndex(["a", "b", "c"], "c", 1)).toBe(0);
    expect(fleetShortcutCycleIndex(["a"], "a", 1)).toBe(0);
    expect(fleetShortcutCycleIndex([], "a", 1)).toBeNull();
    expect(fleetShortcutCycleIndex(["a"], "missing", 1)).toBeNull();

    expect(FLEET_JS).toContain("function cycleAgentShortcut(delta,childOriginated=false)");
    expect(FLEET_JS).toContain("else if(commandId==='previous-agent')accepted=cycleAgentShortcut(-1,childOriginated)");
    expect(FLEET_JS).toMatch(/cycleAgentShortcut[\s\S]*agentShortcutTargets\[/);
    expect(FLEET_JS).toMatch(/cycleAgentShortcut[\s\S]*selectAgent\(target\.node,target\.agent\)/);

    const page = fleetPage(1, "2.5.14");
    expect(page).toContain('id="fleet-shortcuts-heading">Shortcuts</h2>');
    expect(page).toContain('data-shortcut-prefix-label="Ctrl+B"');
    expect(page).toContain('data-command-id="fit-pane-width"');
    expect(page).toContain('>Ctrl+B R</kbd><kbd data-binding-kind="direct"');
    expect(page).toContain('>Alt+S</kbd>');
    expect(page).toContain('data-command-id="select-agent-9"');
    expect(page).toContain('>Alt+9</kbd>');
    expect(page).toContain('data-command-id="last-pane"');
    expect(page).toContain('fleet-shortcut-unbound">Unbound</span>');
    expect((page.match(/data-command-id=/g) ?? [])).toHaveLength(FLEET_COMMANDS.length);
    expect(FLEET_CSS).toContain(".fleet-shortcuts { display: none; }");
    expect(FLEET_CSS).toMatch(/@media \(min-width: 1200px\)[\s\S]*?\.fleet-shortcuts \{ display: block/);
    expect(FLEET_JS).toContain("const COMMAND_CATALOG=shortcutRows.map");
    expect(FLEET_JS).toContain("function recognizeShortcut(event)");
    expect(FLEET_JS).toContain("const SHORTCUT_PREFIX_TIMEOUT_MS=2000");

    const unbound = publicFleetShortcutDocument();
    unbound.bindings["open-command-palette"] = [];
    const overridden = fleetPage(1, "development", parseFleetShortcutDocument(unbound));
    const paletteRow = overridden.slice(overridden.indexOf('data-command-id="open-command-palette"'));
    expect(paletteRow.slice(0, paletteRow.indexOf("</li>"))).toContain("Unbound");
    expect(overridden).not.toContain("shortcuts.default.json");
  });

  test("uses one accessible palette shell for command discovery and Fleet-owned renames", () => {
    const page = fleetPage(1, "development");
    expect(page).toContain('id="command-dialog" class="command-dialog" role="dialog" aria-modal="true"');
    expect(page).toContain('id="command-dialog-input" type="text"');
    expect(page).toContain('aria-controls="command-dialog-results" aria-autocomplete="list"');
    expect(page).toContain('id="command-dialog-results" class="command-dialog-results" role="listbox"');
    expect(FLEET_JS).toContain("function paletteMatches(command,query)");
    expect(FLEET_JS).toContain("terms.every((term)=>haystack.includes(term))");
    expect(FLEET_JS).toContain("if(value&&value[0]!=='/')");
    expect(FLEET_JS).toContain("This input mode is reserved for a future Fleet feature.");
    expect(FLEET_JS).toContain("const query=value.startsWith('/')?value.slice(1):''");
    expect(FLEET_JS).toContain("if(commandDialogState?.mode==='palette'&&event.key==='Enter')");
    expect(FLEET_JS).toContain("if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeCommandDialog");
    expect(FLEET_JS).toContain("commandDialogInput.focus();commandDialogInput.select()");
    expect(FLEET_JS).toContain("kind==='Pane'?'Submit an empty value to clear the Pane label.'");
    expect(FLEET_JS).toContain("if((target.action==='rename-workspace'||target.action==='rename-tab')&&!label)");
    expect(FLEET_JS).not.toContain("window.prompt");
    expect(page).not.toContain("tree-rename");
  });

  test("collapses both desktop rails without replacing the resident frame", () => {
    expect(FLEET_CSS).toContain('.fleet-shell[data-sidebars-collapsed="true"]');
    expect(FLEET_CSS).toContain("transition: grid-template-columns .22s cubic-bezier(.2, .8, .2, 1)");
    expect(FLEET_CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none !important/);
    expect(FLEET_JS).toContain("function setSidebarsCollapsed(collapsed)");
    expect(FLEET_JS).toContain("hostRail.inert=sidebarsCollapsed");
    expect(FLEET_JS).toContain("agentMenu.inert=sidebarsCollapsed");
    const collapseStart = FLEET_JS.indexOf("function setSidebarsCollapsed(collapsed)");
    const collapseEnd = FLEET_JS.indexOf("function acknowledgeCommand", collapseStart);
    const collapseSource = FLEET_JS.slice(collapseStart, collapseEnd);
    expect(collapseSource).not.toContain("frame.src");
    expect(collapseSource).not.toContain("releaseFrame");
    expect(collapseSource).not.toContain("fetch(");
    expect(collapseSource).not.toContain("resize");
  });

  test("captures current Pane and Agent display order and dispatches desktop shortcuts canonically", () => {
    expect(FLEET_JS).toContain("const nextPaneShortcutTargets=[]");
    expect(FLEET_JS).toContain("nextPaneShortcutTargets.push({key:shortcutPaneKey(node.id,paneId,tree.primarySession?'':session)");
    expect(FLEET_JS).toContain("paneShortcutTargets=nextPaneShortcutTargets");
    const directStart = FLEET_JS.indexOf("if(validPanes.length===1)");
    const branchStart = FLEET_JS.indexOf("for(const {pane,paneId} of validPanes)", directStart);
    expect(FLEET_JS.slice(directStart, branchStart)).toContain("nextPaneShortcutTargets.push");
    expect(FLEET_JS.slice(branchStart, FLEET_JS.indexOf("spaceChildrenInner.append(tabRow,tabChildren)", branchStart))).toContain("nextPaneShortcutTargets.push");

    expect(FLEET_JS).toContain("const nextAgentShortcutTargets=[]");
    expect(FLEET_JS).toContain("const position=nextAgentShortcutTargets.length+1;nextAgentShortcutTargets.push(entry)");
    expect(FLEET_JS).toContain("agentShortcutTargets=nextAgentShortcutTargets");
    expect(FLEET_JS).toContain("desktopMode=nextDesktop;renderAgents();syncTreePresentation()");
    expect(FLEET_JS).toContain("element('span','agent-ordinal-badge',String(ordinal))");
    expect(FLEET_JS).not.toContain("agent-shortcut-ordinal");
    expect(FLEET_JS).not.toContain("agent-shortcut-hint");
    expect(FLEET_JS).not.toContain("agent-shortcut-key");
    expect(FLEET_JS).toContain("const shortcutLabel=shortcutBinding?' · Shortcut '+shortcutBinding:''");
    expect(FLEET_CSS).toContain(".agent-ordinal-badge {");
    expect(FLEET_CSS).toMatch(/\.agent-ordinal-badge \{[^}]+border-radius: 999px;/);
    expect(FLEET_CSS).not.toContain(".agent-shortcut-hint");
    expect(FLEET_CSS).toContain(".agent-title-line { padding-right: 2.4rem; }");
    expect(FLEET_CSS).toContain(".agent-meta-line { padding-right: .75rem; }");
    expect(FLEET_CSS).toMatch(/\.agent-card-main \{[^}]+padding: \.65rem 0 \.65rem \.7rem;/);
    expect(FLEET_CSS).toContain("--fleet-selected-foreground: light-dark(oklch(.985 0 0), oklch(.985 0 0))");
    const currentRule = FLEET_CSS.slice(FLEET_CSS.indexOf('.agent-card[data-current-pane="true"] {'), FLEET_CSS.indexOf(".agent-card-copy"));
    expect(currentRule).toContain("border-radius: calc(var(--radius) + 2px)");
    expect(currentRule).toContain("background: var(--accent)");
    expect(currentRule).toContain("color: var(--accent-foreground)");
    expect(currentRule).not.toContain("outline:");
    expect(currentRule).not.toContain("var(--ring)");
    expect(FLEET_CSS).toContain(".tree-row[aria-selected=\"true\"] { background: var(--accent); color: var(--fleet-selected-foreground); }");
    expect(FLEET_CSS).toContain(".fleet-shell[data-tree-open=\"true\"] .tree-row[aria-selected=\"true\"] { background: var(--accent); color: var(--fleet-selected-foreground); }");
    expect(FLEET_JS).toContain("control.setAttribute('aria-current','page')");
    expect(FLEET_JS).toContain("if(card)card.dataset.currentPane='true'");
    expect(FLEET_JS).toContain("control.removeAttribute('aria-current')");
    expect(FLEET_JS).toContain("if(route?.view==='pane'&&route.spaceId&&route.tabId&&route.paneId&&selectedId){");

    expect(FLEET_JS).toContain("function dispatchCommand(commandId,{source='ui',bindingLabel=null,childOriginated=false}={})");
    expect(FLEET_JS).toContain("selectTreeNode(target.nodeId,{route:target.route,focusTreeKey:target.treeKey})");
    expect(FLEET_JS).toContain("selectAgent(target.node,target.agent)");
    expect(FLEET_JS).toContain("if(childOriginated)focusSelectedFrame()");
    expect(FLEET_JS).toContain("const shortcut=recognizeShortcut(event)");
    expect(FLEET_JS).toContain("if(!desktopMedia.matches||document.hidden||event.repeat||pureShortcutModifier(event.code))");
    expect(FLEET_JS).toContain("SHORTCUT_BINDINGS.find((candidate)=>candidate.kind==='prefix'&&shortcutSignature(candidate)===signature)");
    expect(fleetPage(1, "2.5.14")).toContain('id="shortcut-toast"');
    expect(FLEET_CSS).toContain('.shortcut-toast[data-visible="true"]');
    expect(FLEET_JS).toContain("shortcutToast.textContent=(bindingLabel?bindingLabel+' · ':'')+command.name");
    expect(FLEET_JS).toContain("function acknowledgeCommand(command,source,bindingLabel){showCommandToast(command,source==='shortcut'?bindingLabel:null)}");
    expect(FLEET_JS).toContain("shortcutToastTimer=setTimeout");
  });

  test("matches the current Agent by exact node, normalized session, and Pane identity", () => {
    const primary = { nodeId: "alpha", paneId: "w1:p1", herdrSession: "alpha", primarySession: true };
    const named = { nodeId: "alpha", paneId: "w1:p1", herdrSession: "demo", primarySession: false };
    expect(fleetCurrentAgentMatch({ nodeId: "alpha", view: "pane", paneId: "w1:p1" }, primary)).toBeTrue();
    expect(fleetCurrentAgentMatch({ nodeId: "alpha", view: "pane", paneId: "w1:p1", session: "demo" }, named)).toBeTrue();
    expect(fleetCurrentAgentMatch({ nodeId: "beta", view: "pane", paneId: "w1:p1" }, primary)).toBeFalse();
    expect(fleetCurrentAgentMatch({ nodeId: "alpha", view: "pane", paneId: "w1:p2" }, primary)).toBeFalse();
    expect(fleetCurrentAgentMatch({ nodeId: "alpha", view: "pane", paneId: "w1:p1", session: "other" }, named)).toBeFalse();
    expect(fleetCurrentAgentMatch({ nodeId: "alpha", view: "home" }, primary)).toBeFalse();

    const syncStart = FLEET_JS.indexOf("function syncCurrentAgentControl()");
    const syncEnd = FLEET_JS.indexOf("function frameActivityActive", syncStart);
    const syncSource = FLEET_JS.slice(syncStart, syncEnd);
    expect(syncSource).toContain("route?.view==='pane'");
    expect(syncSource).toContain("control.dataset.agentNode===selectedId");
    expect(syncSource).toContain("control.dataset.agentPane===route.paneId");
    expect(syncSource).toContain("(control.dataset.agentSession||'')===(route.session||'')");
    expect(FLEET_JS).toContain("entry.route=route;visitFrame(entry);replaceUrl(id,route);syncCurrentAgentControl()");
    expect(FLEET_JS).toContain("replaceUrl(entry.id,route);syncCurrentAgentControl();openNode.href");
    expect(FLEET_JS).toContain("agentShortcutTargets=nextAgentShortcutTargets;\n syncCurrentAgentControl()");
  });

  test("bridges only the exact selected desktop iframe with correlated allowlisted messages", () => {
    expect(FLEET_JS).toContain("SHORTCUT_CONFIG_MESSAGE='herdr-web-remote:shortcut-config'");
    expect(FLEET_JS).toContain("SHORTCUT_INTENT_MESSAGE='herdr-web-remote:shortcut-intent'");
    expect(FLEET_JS).toContain("SHORTCUT_COMMAND_MESSAGE='herdr-web-remote:shortcut-command'");
    expect(FLEET_JS).toContain("SHORTCUT_RESULT_MESSAGE='herdr-web-remote:shortcut-result'");
    expect(FLEET_JS).toContain("SHORTCUT_READY_MESSAGE='herdr-web-remote:shortcut-ready'");
    expect(FLEET_JS).toContain("target.postMessage({type:SHORTCUT_CONFIG_MESSAGE,version:SHORTCUT_VERSION,generation:shortcutGeneration,active:shortcutFrameActive(entry),prefix,bindings},entry.origin)");
    expect(FLEET_JS).toContain("version:LEGACY_SHORTCUT_VERSION");
    expect(FLEET_JS).toContain("desktopMedia.matches&&!document.hidden&&entry.id===selectedId&&!entry.frame.hidden");
    expect(FLEET_JS).toContain("event.source!==entry.frame.contentWindow||event.origin!==entry.origin");
    expect(FLEET_JS).toContain("exactMessageKeys(data,['type','version','generation','intentId','commandId','bindingLabel'])");
    expect(FLEET_JS).toContain("recentShortcutIntents.has(data.intentId)");
    expect(FLEET_JS).toContain("dispatchCommand(command.id,{source:'shortcut',bindingLabel:data.bindingLabel,childOriginated:true})");
    expect(FLEET_JS).toContain("route?.view!=='pane'");
    expect(FLEET_JS).toContain("version===SHORTCUT_VERSION?{type:SHORTCUT_COMMAND_MESSAGE,version,generation:entry.shortcutGeneration,requestId,action:wireAction}");
    expect(FLEET_JS).toContain("if(pendingShortcutCommand){showTreeActionStatus('Another Pane shortcut is still running.'");
    expect(FLEET_JS).toContain("Collie did not confirm the shortcut");
    expect(FLEET_JS).toContain("if(handleShortcutMessage(event))return");

    const shortcutBridgeStart = FLEET_JS.indexOf("function dispatchSelectedShortcutAction(action)");
    const shortcutBridgeEnd = FLEET_JS.indexOf("function exactMessageKeys", shortcutBridgeStart);
    const shortcutBridge = FLEET_JS.slice(shortcutBridgeStart, shortcutBridgeEnd);
    expect(shortcutBridge).not.toContain("getBoundingClientRect");
    expect(shortcutBridge).not.toContain("measureTerminalColumns");
    expect(shortcutBridge).not.toContain("resizePane");
    expect(shortcutBridge).not.toContain("cols");
    expect(shortcutBridge).not.toContain("fetch(");
    expect(shortcutBridge).not.toContain("keydown");
  });

  test("opens cards through validated canonical instance, Pane, and session selectors", () => {
    expect(FLEET_JS).toContain("const spaceId=validPane(agent.workspaceId)");
    expect(FLEET_JS).toContain("const tabId=validPane(agent.tabId)");
    expect(FLEET_JS).toContain("const paneId=validPane(agent.paneId)");
    expect(FLEET_JS).toContain("agent.primarySession?null:validSession(agent.herdrSession)");
    expect(FLEET_JS).toContain("selectNode(node.id,{route:{view:'pane',spaceId,tabId,paneId");
    expect(FLEET_JS).toContain("url.searchParams.set('space',route.spaceId)");
    expect(FLEET_JS).toContain("url.searchParams.set('tab',route.tabId)");
    expect(FLEET_JS).toContain("url.searchParams.set('pane',route.paneId)");
    expect(FLEET_JS).toContain("url.searchParams.set('session',route.session)");
    expect(FLEET_JS).toContain("closeAgentMenu();");
  });

  test("resets the shared schedule only after live attention-card navigation", () => {
    expect(fleetAttentionResetEligible({ reachable: true, status: "blocked" })).toBeTrue();
    expect(fleetAttentionResetEligible({ reachable: true, status: "done", lastActiveAt: 2, lastSeenAt: 1 })).toBeTrue();
    expect(fleetAttentionResetEligible({ reachable: true, status: "working" })).toBeFalse();
    expect(fleetAttentionResetEligible({ reachable: true, status: "done", lastActiveAt: 1, lastSeenAt: 1 })).toBeFalse();
    expect(fleetAttentionResetEligible({ reachable: false, status: "blocked" })).toBeFalse();
    expect(fleetAttentionResetEligible({ reachable: false, status: "done", lastActiveAt: 2, lastSeenAt: 1 })).toBeFalse();

    const handlerStart = FLEET_JS.indexOf("function selectAgent(node,agent)");
    const handlerEnd = FLEET_JS.indexOf("function renderAgentCard", handlerStart);
    const handler = FLEET_JS.slice(handlerStart, handlerEnd);
    expect(handler).toContain("const resetAttention=Boolean(agent.reachable)&&(bucket(agent)==='ready'||bucket(agent)==='needs')");
    expect(handler.indexOf("selectNode(node.id")).toBeLessThan(handler.indexOf("if(resetAttention)void refresh({manual:true})"));
    expect(handler).toContain("if(!spaceId||!tabId||!paneId");
    expect(FLEET_JS).toContain("if(refreshing){if(manual)queuedManualRefresh=true;return}");
    expect(FLEET_JS).toContain("if(queuedManualRefresh){queuedManualRefresh=false;void refresh({manual:true});return}");

    const failureStart = FLEET_JS.indexOf("}catch(error){", FLEET_JS.indexOf("async function refresh"));
    const failureEnd = FLEET_JS.indexOf("}finally{", failureStart);
    const failure = FLEET_JS.slice(failureStart, failureEnd);
    expect(failure).not.toContain("selectNode(");
    expect(failure).not.toContain("replaceUrl(");
    expect(failure).not.toContain("loadSelected(");
    expect(failure).not.toContain("frame.src");
  });

  test("follows the Gateway's canonical refresh time without a browser backoff", () => {
    expect(fleetRefreshWaitMs(10_100, 5_100)).toBe(5_000);
    expect(fleetRefreshWaitMs(5_101, 5_100)).toBe(250);
    expect(fleetRefreshWaitMs(Number.NaN, 5_100)).toBe(5_000);

    expect(FLEET_JS).toContain("const DEFAULT_REFRESH_MS=5000");
    expect(FLEET_JS).toContain("const MIN_REFRESH_TIMER_MS=250");
    expect(FLEET_JS).toContain("manual?'/api/fleet?manual=1':'/api/fleet'");
    expect(FLEET_JS).toContain("nextAt-generatedAt");
    expect(FLEET_JS).toContain("void refresh({manual:true})");
    expect(FLEET_JS).toContain("void refresh();");
    expect(FLEET_JS).not.toContain("refreshDelayMs");
    expect(FLEET_JS).not.toContain("lastRevision");
    expect(FLEET_JS).not.toContain("data.revision");
    expect(FLEET_JS).not.toContain("setInterval");
  });

  test("restores routes only from an exact registered frame and isolates hidden updates", () => {
    expect(FLEET_JS).toContain("herdr-web-remote:route");
    expect(FLEET_JS).toContain("params.get('pane')");
    expect(FLEET_JS).toContain("params.get('space')");
    expect(FLEET_JS).toContain("params.get('tab')");
    expect(FLEET_JS).toContain("params.get('session')");
    expect(FLEET_JS).toContain("event.source===candidate.frame.contentWindow");
    expect(FLEET_JS).toContain("event.origin!==entry.origin");
    expect(FLEET_JS).toContain("data.version!==1");
    expect(FLEET_JS).toContain("url.searchParams.delete('pane')");
    expect(FLEET_JS).toContain("url.searchParams.delete('space')");
    expect(FLEET_JS).toContain("url.searchParams.delete('tab')");
    expect(FLEET_JS).toContain("url.searchParams.delete('session')");
    expect(FLEET_JS).toContain("history.replaceState");
    expect(FLEET_JS).toContain("if(entry.id!==selectedId)return");
    expect(FLEET_JS).not.toContain("event.data.url");
    expect(FLEET_JS).not.toContain("contentWindow.location");

    const resizeStart = FLEET_JS.indexOf("function renderRailWidths()");
    const resizeEnd = FLEET_JS.indexOf("function requestedRoute()");
    const resizeSource = FLEET_JS.slice(resizeStart, resizeEnd);
    expect(resizeStart).toBeGreaterThan(-1);
    expect(resizeEnd).toBeGreaterThan(resizeStart);
    expect(resizeSource).not.toContain("ensureFrame(");
    expect(resizeSource).not.toContain("loadSelected(");
    expect(resizeSource).not.toContain("selectNode(");
    expect(resizeSource).not.toContain("frame.src");

    expect(FLEET_JS).toContain("if(entry)return entry");
    expect(FLEET_JS).toContain("resident.frame.hidden=resident!==entry");
    expect(FLEET_JS).toContain("entry.route=route;entry.frameKey=routeKey(entry.origin,route)");
    expect(FLEET_JS).toContain("if(entry.id!==selectedId)return");
    expect(FLEET_JS).toContain("if(force||entry.frameKey!==nextFrameKey){entry.frameKey=nextFrameKey;entry.loading=true;entry.frame.src=href}");
  });

  test("navigates Host bodies, keeps disclosure separate, and flattens one-Pane Tabs", () => {
    expect(fleetTreeTabMode([])).toBe("empty");
    expect(fleetTreeTabMode([{ paneId: "w0:p1" }])).toBe("direct");
    expect(fleetTreeTabMode([{ paneId: "w0:p1" }, { paneId: "w0:p2" }])).toBe("branch");
    expect(fleetTreeTabMode([{ paneId: "../../private" }])).toBe("empty");
    expect(fleetTreeTabMode([{ paneId: "w0:p1" }, { paneId: "w0:p1" }])).toBe("direct");

    expect(FLEET_JS).toContain("event.target.closest('.tree-chevron')");
    expect(FLEET_JS).toContain("selectTreeNode(node.id,{route:{view:'pane',spaceId:pane.workspaceId");
    expect(FLEET_JS).toContain("selectTreeNode(node.id,{route:{view:'home'},focusTreeKey:hostKey})");
    expect(FLEET_JS).toContain("event.key==='ArrowRight'");
    expect(FLEET_JS).toContain("event.key!=='ArrowRight'&&event.key!=='ArrowLeft'");
    expect(FLEET_JS).toContain("button.addEventListener('click',()=>toggleTree(key))");
    expect(FLEET_JS).toContain("const tabLabel=tab.label||'Tab '+tab.number;const validPanes=validTabPanes(tab)");
    expect(FLEET_JS).toContain("if(validPanes.length<=1)expandedTreeKeys.delete(tabKey)");
    expect(FLEET_JS).toContain("if(validPanes.length===1)");
    expect(FLEET_JS).toContain("appendPaneTreatment(tabRow,pane,tabLabel)");
    expect(FLEET_JS).toContain("direct-pane-tree-row");
    expect(FLEET_JS).toContain("paneRow.addEventListener('click',()=>selectTreeNode(node.id");
    expect(FLEET_JS).not.toContain("appendPaneTreatment(tabRow,pane,paneLabel(pane))");
  });

  test("delegates only bounded exact-child Host, Space, Tab, and Pane actions", () => {
    expect(FLEET_JS).toContain("ACTION_PROBE_MESSAGE='herdr-web-remote:action-probe'");
    expect(FLEET_JS).toContain("ACTION_REQUEST_MESSAGE='herdr-web-remote:action-request'");
    expect(FLEET_JS).toContain("ACTION_RESULT_MESSAGE='herdr-web-remote:action-result'");
    expect(FLEET_JS).toContain("event.source!==state.frame.contentWindow||event.origin!==state.origin");
    expect(FLEET_JS).toContain("target.postMessage(state.request,state.origin)");
    expect(FLEET_JS).toContain("state.phase='sent'");
    expect(FLEET_JS).not.toContain("setInterval");
    expect(FLEET_JS).toContain("const temporary=!resident");
    expect(FLEET_JS).toContain("if(state.temporary)state.frame.remove()");
    expect(FLEET_JS).toContain("action:'create-workspace'");
    expect(FLEET_JS).toContain("primaryTree=trees.find((tree)=>tree&&tree.primarySession===true)");
    expect(FLEET_JS).toContain("addSpace.hidden=node.health!=='online'||primaryTree?.reachable!==true");
    expect(FLEET_JS).toContain("action:'create-tab',workspaceId:target.workspaceId");
    expect(FLEET_JS).toContain("bindTreeContextActions(tabRow,{nodeId:node.id,kind:'tab',action:'rename-tab'");
    expect(FLEET_JS).toContain("bindTreeContextActions(paneRow,{nodeId:node.id,kind:'pane',action:'rename-pane'");
    expect(FLEET_JS).not.toContain("function bindRename(");
    expect(FLEET_JS).toContain("event.key!=='ContextMenu'&&!(event.shiftKey&&event.key==='F10')");
    expect(FLEET_JS).not.toContain("action:'rename-space'");
    expect(FLEET_JS).not.toContain("action:'rename-host'");
    expect(FLEET_JS).not.toContain("contentWindow.fetch");
    expect(FLEET_CSS).toContain(".tree-inline-action");
    expect(FLEET_CSS).toContain(".command-dialog {");
    expect(FLEET_CSS).not.toContain(".tree-rename {");
    expect(fleetPage()).toContain('id="command-dialog" class="command-dialog" role="dialog" aria-modal="true"');
    expect(fleetPage()).toContain('id="tree-context-menu" class="tree-context-menu" role="menu"');
    expect(fleetPage()).toContain('id="tree-context-rename" type="button" role="menuitem"');
    expect(fleetPage()).toContain('id="tree-context-close" class="tree-context-destructive" type="button" role="menuitem"');
    expect(FLEET_JS).toContain("treeContextRename.focus()");
    expect(FLEET_JS).toContain("row.setAttribute('aria-haspopup','menu')");
    expect(FLEET_JS).toContain("event.key==='ArrowDown'||event.key==='ArrowUp'");
    expect(FLEET_JS).toContain("event.key==='Home'||event.key==='End'");
    expect(FLEET_JS).toContain("if(event.key==='Tab'){setTimeout(()=>closeTreeContextMenu(),0);return}");
    expect(FLEET_JS).toContain("closeTreeContextMenu({restoreFocus:true})");
    expect(FLEET_JS).toContain("addEventListener('resize',()=>closeTreeContextMenu())");
    expect(FLEET_JS).toContain("const CLOSE_CONFIRM_MS=3000");
    expect(FLEET_JS).toContain("treeContextClose.dataset.armed!=='true'");
    expect(FLEET_JS).toContain("action:'close-tab'");
    expect(FLEET_JS).toContain("action:'close-pane'");
    expect(FLEET_JS).toContain("if(affectsCurrent)selectNode(node.id,{route:{view:'home'}})");
    expect(FLEET_JS).toContain("void refresh({manual:true})");
  });

  test("computes exact close route effects and defers ambiguous reconciliation", () => {
    const primaryRoute = { nodeId: "alpha", view: "pane" as const, paneId: "w1:p2", tabId: "w1:t1" };
    expect(fleetCloseAffectsRoute(primaryRoute, { nodeId: "alpha", kind: "pane", targetId: "w1:p2" })).toBeTrue();
    expect(fleetCloseAffectsRoute(primaryRoute, { nodeId: "alpha", kind: "pane", targetId: "w1:p3" })).toBeFalse();
    expect(fleetCloseAffectsRoute(primaryRoute, { nodeId: "alpha", kind: "tab", targetId: "w1:t1", paneIds: [] })).toBeTrue();
    expect(fleetCloseAffectsRoute(primaryRoute, { nodeId: "alpha", kind: "tab", targetId: "renamed", paneIds: ["w1:p2"] })).toBeTrue();
    expect(fleetCloseAffectsRoute(primaryRoute, { nodeId: "beta", kind: "tab", targetId: "w1:t1", paneIds: ["w1:p2"] })).toBeFalse();
    expect(fleetCloseAffectsRoute({ ...primaryRoute, session: "demo" }, { nodeId: "alpha", kind: "pane", targetId: "w1:p2" })).toBeFalse();

    expect(FLEET_JS).toContain("function currentRouteAuthoritativelyMissing()");
    expect(FLEET_JS).toContain("if(!tree||tree.reachable!==true)return false");
    expect(FLEET_JS).toContain("if(currentRouteAuthoritativelyMissing())");
    expect(FLEET_JS).toContain("entry.route={view:'home'};entry.frameKey=null;replaceUrl(entry.id,entry.route)");
    const closeStart = FLEET_JS.indexOf("async function activateTreeContextClose()");
    const closeEnd = FLEET_JS.indexOf("async function createPaneFromSpace", closeStart);
    const closeSource = FLEET_JS.slice(closeStart, closeEnd);
    expect(closeSource).toContain("await dispatchNodeAction(node");
    expect(closeSource).not.toContain("retry");
    expect(closeSource).not.toContain("setInterval");
  });

  test("uses the compact H mark as a mutually exclusive, dismissible tree drawer", () => {
    expect(FLEET_JS).toContain("let treeOpen=false");
    expect(FLEET_JS).toContain("shell.dataset.treeOpen='true'");
    expect(FLEET_JS).toContain("delete shell.dataset.treeOpen");
    expect(FLEET_JS).toContain("closeAgentMenu({syncActivity:false});treeOpen=true");
    expect(FLEET_JS).toContain("closeTreeMenu({syncActivity:false});agentMenu.hidden=false");
    expect(FLEET_JS).toContain("treeMenuBackdrop.addEventListener('click'");
    expect(FLEET_JS).toContain("if(treeOpen){closeTreeMenu({restoreFocus:true});return}");
    expect(FLEET_JS).toContain("if(nextDesktop){closeTreeMenu()");
    expect(FLEET_JS).toContain("if(compactTree)closeTreeMenu({restoreFocus:true})");
    expect(FLEET_JS).toContain("if(desktopMedia.matches||treeOpen){selectTreeNode(node.id");
  });

  test("keeps the compact Host switcher structurally independent from the tree drawer", () => {
    expect(FLEET_JS).toContain("const hostSwitcher=document.querySelector('#host-switcher')");
    expect(FLEET_JS).toContain("function renderHostSwitcher(focusSelected=false)");
    expect(FLEET_JS).toContain("function renderTree(focusKey=null)");
    expect(FLEET_JS).toContain("element('button','instance-tab host-switcher-tab')");
    expect(FLEET_JS).toContain("button.setAttribute('role','tab')");
    expect(FLEET_JS).toContain("button.addEventListener('click',()=>selectNode(node.id,{focusTab:true}))");
    expect(FLEET_JS).toContain("renderTree(typeof focusSelected==='string'?focusSelected:null);renderHostSwitcher(focusSelected===true)");
    expect(FLEET_JS).toContain("hostSwitcher.addEventListener('keydown'");
    expect(FLEET_JS).toContain("selectedId=null;hostSwitcher.replaceChildren();instances.replaceChildren()");

    const toggleStart = FLEET_JS.indexOf("function toggleTree(key)");
    const toggleEnd = FLEET_JS.indexOf("function handleDisclosureKey", toggleStart);
    const toggleSource = FLEET_JS.slice(toggleStart, toggleEnd);
    expect(toggleSource).toContain("if(!row||!group){renderTree(key);return}");
    expect(toggleSource).toContain("group.dataset.expanded=String(expanded)");
    expect(toggleSource).not.toContain("renderTabs(");
    expect(toggleSource).not.toContain("renderHostSwitcher(");

    const openStart = FLEET_JS.indexOf("function openTreeMenu()");
    const openEnd = FLEET_JS.indexOf("function closeAgentMenu", openStart);
    const openSource = FLEET_JS.slice(openStart, openEnd);
    expect(openSource).not.toContain("renderTabs(");
    expect(openSource).not.toContain("renderHostSwitcher(");

    const treeStart = FLEET_JS.indexOf("function renderTree(focusKey=null)");
    const treeEnd = FLEET_JS.indexOf("function renderTabs", treeStart);
    expect(FLEET_JS.slice(treeStart, treeEnd)).not.toContain("hostSwitcher");
  });

  test("animates disclosure and aligns Lucide chevrons with Pane state dots", () => {
    const page = fleetPage(1, "2.5.10");
    expect(page).toContain('id="instances"');
    expect(page).toContain('aria-hidden="true" inert');
    expect(FLEET_CSS).toContain("--tree-indicator-size: .5rem");
    expect(FLEET_CSS).toMatch(/\.tree-chevron \{[^}]*width: var\(--tree-indicator-size\);[^}]*height: var\(--tree-indicator-size\);[^}]*transform-origin: 50% 50%/);
    expect(FLEET_CSS).toMatch(/\.tree-pane-dot \{[^}]*width: var\(--tree-indicator-size\);[^}]*height: var\(--tree-indicator-size\)/);
    expect(FLEET_CSS).toMatch(/\.tree-children \{[^}]*display: grid;[^}]*grid-template-rows: 0fr;[^}]*transition: grid-template-rows/);
    expect(FLEET_CSS).toContain('.tree-children[data-expanded="true"] { grid-template-rows: 1fr; opacity: 1; }');
    expect(FLEET_CSS).toContain(".tree-children-inner { min-height: 0; overflow: hidden; }");
    expect(FLEET_CSS).toMatch(/@media \(max-width: 1199px\)[\s\S]*?\.instance-strip \{[^}]*transform: translateX\(calc\(-100% - 1rem\)\);[^}]*transition: transform \.2s/);
    expect(FLEET_CSS).toMatch(/\.fleet-shell\[data-tree-open="true"\] \.instance-strip \{[^}]*transform: translateX\(0\)/);
    expect(FLEET_CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.instance-strip, \.host-rail-footer, \.tree-children, \.tree-chevron \{ transition: none !important; \}/);

    expect(FLEET_JS).toContain("document.createElementNS('http://www.w3.org/2000/svg','svg')");
    expect(FLEET_JS).toContain("path.setAttribute('d','m9 18 6-6-6-6')");
    expect(FLEET_JS).toContain("svg.dataset.icon='chevron-right'");
    expect(FLEET_JS).toContain("function treeChildrenGroup(key,expanded)");
    expect(FLEET_JS).toContain("group.inert=!expanded;group.setAttribute('aria-hidden',String(!expanded))");
    expect(FLEET_JS).toContain("group.dataset.treeChildren=key;group.dataset.expanded=String(expanded)");
    expect(FLEET_JS).toContain("function syncTreePresentation()");
    expect(FLEET_JS).toContain("const hidden=!desktopMedia.matches&&!treeOpen;instances.inert=hidden");
    expect(FLEET_JS).not.toContain("element('span','tree-chevron','›')");
    expect(FLEET_JS).not.toMatch(/\.hidden=!.*Open/);
  });
});
