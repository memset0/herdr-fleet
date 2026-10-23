import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("precache limit", () => {
  test("the web build precaches a main chunk up to 4 MiB", () => {
    const source = readFileSync(new URL("../web/vite.config.ts", import.meta.url), "utf8");
    expect(source).toContain("maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,");
  });
});
