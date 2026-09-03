import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

describe("service-worker authentication boundary", () => {
  test("registers network-first document navigation before precaching", () => {
    const source = readFileSync(resolve(import.meta.dir, "../web/src/sw.ts"), "utf8");
    const navigation = source.indexOf("registerRoute(new NavigationRoute(({ request }) => fetch(request)))");
    const precache = source.indexOf("precacheAndRoute(self.__WB_MANIFEST)");
    expect(navigation).toBeGreaterThanOrEqual(0);
    expect(precache).toBeGreaterThan(navigation);
    expect(source).not.toContain("createHandlerBoundToURL");
  });
});
