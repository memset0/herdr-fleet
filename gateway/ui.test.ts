import { describe, expect, test } from "bun:test";

import {
  FLEET_CSS,
  FLEET_JS,
  fleetAgentBucket,
  fleetHeaderAgentCount,
  fleetIframeCacheQuietExpired,
  fleetIframeEvictionCandidate,
  fleetPage,
  fleetRefreshWaitMs,
} from "./fleet-ui.ts";

describe("Fleet iframe shell", () => {
  test("renders a lazy frame stage, responsive Host tree, and reused Agent surface", () => {
    const page = fleetPage();
    expect(page).not.toContain("<iframe");
    expect(page).toContain('data-iframe-cache-size="1"');
    expect(fleetPage(5)).toContain('data-iframe-cache-size="5"');
    expect(fleetPage(99)).toContain('data-iframe-cache-size="1"');
    expect(page).toContain('id="instances"');
    expect(page).toContain('role="tree"');
    expect(page).toContain('id="agent-menu-toggle"');
    expect(page).toContain('aria-haspopup="dialog"');
    expect(page).toContain('id="agent-menu"');
    expect(page.indexOf('id="agent-menu"')).toBeLessThan(page.indexOf('id="frame-stage"'));
    expect(page).toContain('id="open-node"');
    expect(page).toContain('data-icon="agent"');
    expect(page).toContain('data-icon="external-link"');
    expect(page).toContain('d="M15 3h6v6"');
    expect(page).not.toContain("agent-menu-glyph");
    expect(page).not.toContain("/auth/logout");
    expect(page).not.toContain("logout-form");
    expect(page).not.toContain("Sign out");
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
    expect(FLEET_CSS).toContain(".tree-row-level-4");
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
  });
});
