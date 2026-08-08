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
