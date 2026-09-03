import { describe, expect, test } from "bun:test";

import {
  FLEET_COMMANDS,
  parseFleetShortcutDocument,
  publicFleetShortcutDocument,
} from "../../shared/fleet/index.ts";
import { fleetPage } from "./page.ts";

describe("Fleet page", () => {
  test("renders the stable shell and accessible controls without eagerly creating a frame", () => {
    const page = fleetPage(1, "2.4.1");
    expect(page).not.toContain("<iframe");
    expect(page).toContain('data-iframe-cache-size="1"');
    expect(page).toContain('data-plugin-version="2.4.1"');
    expect(page).toContain('aria-label="Web Remote version 2.4.1"');
    expect(page).toContain('id="host-switcher"');
    expect(page).toContain('id="instances"');
    expect(page).toContain('role="tree"');
    expect(page).toContain('id="frame-stage"');
    expect(page).toContain('id="agent-menu"');
    expect(page.indexOf('id="agent-menu"')).toBeLessThan(
      page.indexOf('id="frame-stage"'),
    );
    expect(page).toContain('id="fleet-settings-toggle"');
    expect(page).toContain('id="fleet-settings"');
    expect(page).toContain('id="iframe-cache-size"');
    expect(page).toContain('id="iframe-cache-reset"');
    expect(page).toContain('id="command-dialog"');
    expect(page).toContain('id="tree-context-menu"');
    expect(page).toContain('role="separator"');
    expect(page).toContain(
      '<script type="module" src="/fleet-assets/fleet.js"></script>',
    );
    expect(page).toContain(
      '<link rel="stylesheet" href="/fleet-assets/fleet.css">',
    );
    expect(page).not.toContain("/auth/logout");
    expect(page).not.toContain("Emergency terminal");
  });

  test("bounds server-provided metadata", () => {
    expect(fleetPage(1, '<script>alert("x")</script>')).toContain(
      'data-plugin-version="unknown"',
    );
    expect(fleetPage(5)).toContain('data-iframe-cache-size="5"');
    expect(fleetPage(99)).toContain('data-iframe-cache-size="1"');
  });

  test("renders the complete effective command catalog without exposing its source path", () => {
    const page = fleetPage(1, "2.9.0");
    expect(page).toContain('data-shortcut-prefix-label="Ctrl+B"');
    expect(page).toContain('data-command-id="fit-pane-width"');
    const fitRow = page.slice(page.indexOf('data-command-id="fit-pane-width"'));
    expect(fitRow.slice(0, fitRow.indexOf("</li>"))).toMatch(
      /Ctrl\+B R[\s\S]*Alt\+S/,
    );
    expect(page).toContain('data-command-id="select-agent-9"');
    expect(page.match(/data-command-id=/g) ?? []).toHaveLength(
      FLEET_COMMANDS.length,
    );

    const unbound = publicFleetShortcutDocument();
    unbound.bindings["open-command-palette"] = [];
    const overridden = fleetPage(
      1,
      "development",
      parseFleetShortcutDocument(unbound),
    );
    const row = overridden.slice(
      overridden.indexOf('data-command-id="open-command-palette"'),
    );
    expect(row.slice(0, row.indexOf("</li>"))).toContain("Unbound");
    expect(overridden).not.toContain("shortcuts.default.json");
  });
});
