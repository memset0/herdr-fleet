import { describe, expect, test } from "bun:test";

import {
  FLEET_CSS,
  FLEET_JS,
  fleetAgentBucket,
  fleetPage,
  nextFleetRefreshDelay,
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
    expect(page).toContain('id="retry-frame"');
    expect(page).not.toContain("Fleet totals");
    expect(page).not.toContain('class="node-grid"');
    expect(FLEET_CSS).toMatch(/max-width:\s*640px/);
    expect(FLEET_CSS).toMatch(/height:\s*100dvh/);
    expect(FLEET_CSS).toMatch(/html, body \{ height: 100%; overflow: hidden/);
    expect(FLEET_CSS).toMatch(/\.agent-sections \{[^}]*overflow-y: auto/);
    expect(FLEET_CSS).toMatch(/\.frame-stage \{[^}]*min-height: 0;[^}]*overflow: hidden/);
    expect(FLEET_CSS).toMatch(/\.node-frame \{[^}]*width: 100%;[^}]*height: 100%;[^}]*border: 0/);
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
    expect(FLEET_JS).toContain("{key:'offline',label:'Offline'");
    expect(FLEET_JS).toContain("element('span','host-chip',node.name)");
    expect(FLEET_JS).toContain("element('span','offline-chip','offline')");
    expect(FLEET_CSS).toContain("--status-blocked:");
    expect(FLEET_CSS).toContain("--status-working:");
    expect(FLEET_CSS).toContain('.agent-card[data-live="false"]');

    expect(fleetAgentBucket({ reachable: true, status: "blocked" })).toBe("needs");
    expect(fleetAgentBucket({ reachable: true, status: "done", lastActiveAt: 2, lastSeenAt: 1 })).toBe("ready");
    expect(fleetAgentBucket({ reachable: true, status: "working" })).toBe("working");
    expect(fleetAgentBucket({ reachable: true, status: "idle" })).toBe("recent");
    expect(fleetAgentBucket({ reachable: false, status: "working" })).toBe("offline");
  });

  test("opens cards through validated canonical instance, Pane, and session selectors", () => {
    expect(FLEET_JS).toContain("const paneId=validPane(agent.paneId)");
    expect(FLEET_JS).toContain("agent.primarySession?null:validSession(agent.herdrSession)");
    expect(FLEET_JS).toContain("selectNode(node.id,{route:{view:'pane',paneId");
    expect(FLEET_JS).toContain("url.searchParams.set('pane',route.paneId)");
    expect(FLEET_JS).toContain("url.searchParams.set('session',route.session)");
    expect(FLEET_JS).toContain("closeAgentMenu();");
  });

  test("backs unchanged refreshes off to one hour and resets manual or changed refreshes", () => {
    expect(nextFleetRefreshDelay(5_000, 5_000, 3_600_000, { manual: false, unchanged: true })).toBe(10_000);
    expect(nextFleetRefreshDelay(10_000, 5_000, 3_600_000, { manual: false, unchanged: true })).toBe(20_000);
    expect(nextFleetRefreshDelay(3_600_000, 5_000, 3_600_000, { manual: false, unchanged: true })).toBe(3_600_000);
    expect(nextFleetRefreshDelay(600_000, 5_000, 3_600_000, { manual: true, unchanged: true })).toBe(5_000);
    expect(nextFleetRefreshDelay(600_000, 5_000, 3_600_000, { manual: false, unchanged: false })).toBe(5_000);

    expect(FLEET_JS).toContain("const DEFAULT_REFRESH_MS=5000");
    expect(FLEET_JS).toContain("const DEFAULT_MAX_REFRESH_MS=3600000");
    expect(FLEET_JS).toContain("refreshDelayMs=manual?refreshBaseMs:unchanged?Math.min");
    expect(FLEET_JS).toContain("clearRefreshTimer();refreshDelayMs=refreshBaseMs");
    expect(FLEET_JS).toContain("void refresh({manual:true})");
    expect(FLEET_JS).toContain("void refresh();");
    expect(FLEET_JS).not.toContain("setInterval");
  });

  test("restores and accepts only canonical routes from the selected node frame", () => {
    expect(FLEET_JS).toContain("herdr-web-remote:route");
    expect(FLEET_JS).toContain("params.get('pane')");
    expect(FLEET_JS).toContain("params.get('session')");
    expect(FLEET_JS).toContain("event.source!==frame.contentWindow");
    expect(FLEET_JS).toContain("event.origin!==currentOrigin");
    expect(FLEET_JS).toContain("data.version!==1");
    expect(FLEET_JS).toContain("url.searchParams.delete('pane')");
    expect(FLEET_JS).toContain("url.searchParams.delete('session')");
    expect(FLEET_JS).toContain("history.replaceState");
    expect(FLEET_JS).not.toContain("event.data.url");
    expect(FLEET_JS).not.toContain("contentWindow.location");
  });
});
