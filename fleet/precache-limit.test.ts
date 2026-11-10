import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PRECACHE_MAX_FILE_BYTES } from "../web/vite-icons.ts";

describe("precache limit", () => {
  test("the web build precaches a main chunk up to 4 MiB through upstream's shared limit", () => {
    const source = readFileSync(new URL("../web/vite.config.ts", import.meta.url), "utf8");
    expect(source).toContain("maximumFileSizeToCacheInBytes: PRECACHE_MAX_FILE_BYTES");
    expect(PRECACHE_MAX_FILE_BYTES).toBeGreaterThanOrEqual(4 * 1024 * 1024);
  });
});
