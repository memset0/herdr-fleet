import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const indexCss = readFileSync("src/index.css", "utf8");

describe("document scroll ownership", () => {
  test("clips the Collie document root so route content owns vertical scrolling", () => {
    expect(indexCss).toMatch(
      /html,\s*body,\s*#root\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/s,
    );
    expect(indexCss).toMatch(/html,\s*body,\s*#root\s*\{[^}]*overflow:\s*clip;/s);
  });
});

describe("Fleet-framed Pane chrome", () => {
  test("uses only root-scoped purpose-built hooks and static declarations", () => {
    const block = indexCss.match(
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
      const selectors = [...indexCss.matchAll(new RegExp(`([^{}]+\\[${hook}\\][^{}]*)\\{`, "g"))]
        .map((match) => match[1]!.trim());
      expect(selectors.length).toBeGreaterThan(0);
      expect(selectors.every((selector) => selector.includes(":root[data-fleet-frame]"))).toBe(true);
    }
  });
});
