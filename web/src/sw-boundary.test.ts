import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The upstream font cache and the fork's Gateway navigation rule met in one conflict. Keep the
// composed result source-tested without evaluating a service worker inside jsdom.
const source = readFileSync(resolve(import.meta.dirname, "sw.ts"), "utf8");

describe("service-worker Gateway boundary", () => {
  it("registers network-first navigation before the precache routes", () => {
    const navigation = source.indexOf(
      "registerRoute(new NavigationRoute(({ request }) => fetch(request)))",
    );
    const precache = source.indexOf("precacheAndRoute(self.__WB_MANIFEST)");

    expect(navigation).toBeGreaterThanOrEqual(0);
    expect(precache).toBeGreaterThan(navigation);
    expect(source).not.toContain("createHandlerBoundToURL");
  });

  it("limits the lazy cache to validated same-origin font responses", () => {
    expect(source).toContain('sameOrigin && url.pathname.startsWith("/fonts/")');
    expect(source).toContain("response.status === 200");
    expect(source).toContain("!response.redirected");
    expect(source).toContain('.includes("font")');
    expect(source).toContain("new Set<string>(FONT_URLS)");
  });
});
