import { describe, expect, test } from "bun:test";

import { FLEET_CSS, FLEET_JS, fleetPage } from "./ui.ts";

describe("Fleet iframe shell", () => {
  test("renders one Collie viewport and one compact instance row", () => {
    const page = fleetPage();
    expect(page.match(/<iframe\b/g)?.length).toBe(1);
    expect(page).toContain('id="instances"');
    expect(page).toContain('role="tablist"');
    expect(page).toContain('id="open-node"');
    expect(page).toContain('id="retry-frame"');
    expect(page).not.toContain("Fleet totals");
    expect(page).not.toContain('class="node-grid"');
    expect(FLEET_CSS).toContain("max-width:640px");
    expect(FLEET_CSS).toContain("height:100dvh");
    expect(FLEET_CSS).toContain("html,body{height:100%;overflow:hidden}");
    expect(FLEET_CSS).toContain(".frame-stage{position:relative;display:flex;min-height:0;flex:1;overflow:hidden");
    expect(FLEET_CSS).toContain(".node-frame{display:block;width:100%;height:100%;border:0");
  });

  test("keeps selection URL-addressable without rebuilding Collie content", () => {
    expect(() => new Function(FLEET_JS)).not.toThrow();
    expect(FLEET_JS).toContain("searchParams.get('instance')");
    expect(FLEET_JS).toContain("localStorage.getItem(STORAGE_KEY)");
    expect(FLEET_JS).toContain("history.replaceState");
    expect(FLEET_JS).toContain("currentFrameKey!==nextFrameKey");
    expect(FLEET_JS).toContain("frame.src=href");
    expect(FLEET_JS).not.toContain("innerHTML");
    expect(FLEET_JS).not.toContain("sessionHref");
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
