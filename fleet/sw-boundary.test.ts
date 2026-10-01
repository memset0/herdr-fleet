import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

describe("service-worker authentication boundary", () => {
  test("registers network-first document navigation before precaching", () => {
    const source = readFileSync(resolve(import.meta.dir, "../web/src/sw.ts"), "utf8");
    const navigation = source.indexOf("registerRoute(new NavigationRoute(({ request }) => fetch(request)))");
    // Upstream reads the injection point once into `PRECACHE_MANIFEST` (its precache-progress plugin
    // counts against it) and precaches that; either spelling is the precache, and it must be read
    // exactly once, after the network-first route is registered.
    const manifestReads = source.match(/self\.__WB_MANIFEST/g) ?? [];
    const manifest = source.indexOf("self.__WB_MANIFEST");
    const precache = Math.max(
      source.indexOf("precacheAndRoute(self.__WB_MANIFEST)"),
      source.indexOf("precacheAndRoute(PRECACHE_MANIFEST)"),
    );
    expect(navigation).toBeGreaterThanOrEqual(0);
    expect(manifestReads).toHaveLength(1);
    expect(manifest).toBeGreaterThan(navigation);
    expect(precache).toBeGreaterThan(navigation);
    expect(source).not.toContain("createHandlerBoundToURL");
  });
});
