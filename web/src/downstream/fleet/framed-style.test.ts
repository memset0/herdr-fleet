import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const framedCss = readFileSync("src/downstream/fleet/framed.css", "utf8");
const indexCss = readFileSync("src/index.css", "utf8");

describe("document scroll ownership", () => {
  test("clips only a Fleet-framed document root", () => {
    expect(framedCss).toMatch(
      /:root\[data-fleet-frame\],\s*:root\[data-fleet-frame\] body,\s*:root\[data-fleet-frame\] #root\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/s,
    );
    expect(framedCss).toMatch(/#root\s*\{[^}]*overflow:\s*clip;/s);
    expect(indexCss).not.toContain("data-fleet-frame");
  });
});

describe("Fleet-framed Pane chrome", () => {
  test("uses only root-scoped purpose-built hooks and static declarations", () => {
    const block = framedCss.match(
      /:root\[data-fleet-frame\][\s\S]*?\[data-fleet-controls-row\]\s*\{[^}]*\}/,
    )?.[0];
    expect(block).toBeDefined();
    expect(block).toContain(":root[data-fleet-frame] [data-fleet-pane-switch-trigger]");
    expect(block).toContain(":root[data-fleet-frame] [data-fleet-controls-label]");
    expect(block).toContain(":root[data-fleet-frame] [data-fleet-controls-row]");
    expect(block).toMatch(/\[data-fleet-controls-label\]\s*\{\s*display:\s*none;/);
    expect(block).toMatch(/\[data-fleet-controls-row\]\s*\{\s*padding-top:\s*0;/);
    expect(block).not.toMatch(/\[aria-label|\[class|!important/i);
  });

  test("defines no unscoped target hook selector", () => {
    for (const hook of [
      "data-fleet-pane-switch-trigger",
      "data-fleet-controls-label",
      "data-fleet-controls-row",
    ]) {
      const selectors = [...framedCss.matchAll(new RegExp(`([^{}]+\\[${hook}\\][^{}]*)\\{`, "g"))]
        .map((match) => match[1]!.trim());
      expect(selectors.length).toBeGreaterThan(0);
      expect(selectors.every((selector) => selector.includes(":root[data-fleet-frame]"))).toBe(true);
    }
  });
});
