import { describe, expect, test } from "bun:test";

import {
  FLEET_CSS,
  FLEET_JS,
  fleetAgentBucket,
  fleetHeaderAgentCount,
  fleetPage,
  fleetRefreshWaitMs,
} from "./fleet-ui.ts";

describe("Fleet iframe shell", () => {
  test("renders one Collie viewport, one compact instance row, and an outer Agent menu", () => {
    const page = fleetPage();
    expect(page.match(/<iframe\b/g)?.length).toBe(1);
    expect(page).toContain('id="instances"');
    expect(page).toContain('role="tablist"');
    expect(page).toContain('id="agent-menu-toggle"');
    expect(page).toContain('aria-haspopup="dialog"');
    expect(page).toContain('id="agent-menu"');
    expect(page.indexOf('id="agent-menu"')).toBeLessThan(page.indexOf('id="node-frame"'));
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
    expect(FLEET_CSS).toMatch(/max-width:\s*640px/);
    expect(FLEET_CSS).toMatch(/height:\s*100dvh/);
    expect(FLEET_CSS).toMatch(/html, body \{ height: 100%; overflow: hidden/);
    expect(FLEET_CSS).toMatch(/\.agent-sections \{[^}]*overflow-y: auto/);
    expect(FLEET_CSS).toMatch(/\.frame-stage \{[^}]*min-height: 0;[^}]*overflow: hidden/);
    expect(FLEET_CSS).toMatch(/\.node-frame \{[^}]*width: 100%;[^}]*height: 100%;[^}]*border: 0/);
    expect(FLEET_CSS).toMatch(/\.agent-menu-toggle \{[^}]*grid-template-columns: auto auto/);
    expect(FLEET_CSS).toMatch(/\.agent-menu-count \{[^}]*color: currentColor/);
    expect(FLEET_CSS).not.toMatch(/\.agent-menu-count \{[^}]*position: absolute/);
  });

  test("keeps selection URL-addressable without rebuilding Collie content", () => {
    expect(() => new Function(FLEET_JS)).not.toThrow();
    expect(FLEET_JS).toContain("searchParams.get('instance')");
    expect(FLEET_JS).toContain("localStorage.getItem(STORAGE_KEY)");
    expect(FLEET_JS).toContain("history.replaceState");
    expect(FLEET_JS).toContain("currentFrameKey!==nextFrameKey");
    expect(FLEET_JS).toContain("frame.src=href");
    expect(FLEET_JS).not.toContain("innerHTML");
    expect(FLEET_JS).toContain("textContent=String(text)");
    expect(FLEET_JS).toContain("replaceChildren");
    expect(FLEET_JS).not.toContain("sessionHref");
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

  test("restores and accepts only canonical routes from the selected node frame", () => {
    expect(FLEET_JS).toContain("herdr-web-remote:route");
    expect(FLEET_JS).toContain("params.get('pane')");
    expect(FLEET_JS).toContain("params.get('space')");
    expect(FLEET_JS).toContain("params.get('tab')");
    expect(FLEET_JS).toContain("params.get('session')");
    expect(FLEET_JS).toContain("event.source!==frame.contentWindow");
    expect(FLEET_JS).toContain("event.origin!==currentOrigin");
    expect(FLEET_JS).toContain("data.version!==1");
    expect(FLEET_JS).toContain("url.searchParams.delete('pane')");
    expect(FLEET_JS).toContain("url.searchParams.delete('space')");
    expect(FLEET_JS).toContain("url.searchParams.delete('tab')");
    expect(FLEET_JS).toContain("url.searchParams.delete('session')");
    expect(FLEET_JS).toContain("history.replaceState");
    expect(FLEET_JS).not.toContain("event.data.url");
    expect(FLEET_JS).not.toContain("contentWindow.location");
  });
});
