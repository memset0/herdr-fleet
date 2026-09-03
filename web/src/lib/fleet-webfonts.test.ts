import { CJK_FALLBACK_NONE, fleetWebfont } from "../../../fleet/ui/webfonts.ts";
import { applyFleetWebfont, neededWebfont } from "./fleet-webfonts";

const MAPLE = fleetWebfont("maple-mono-cn")!;

function link() {
  return document.getElementById("fleet-webfont-stylesheet");
}

function cjk() {
  return document.documentElement.style.getPropertyValue("--font-cjk");
}

afterEach(() => {
  link()?.remove();
  document.documentElement.style.removeProperty("--font-cjk");
});

describe("which face the document needs", () => {
  it("takes the chosen fallback whatever the two Latin pickers say", () => {
    expect(
      neededWebfont({ cjkFallback: MAPLE.id, designFont: "aldrich", terminalFont: "system" }),
    ).toEqual(MAPLE);
  });

  it("takes the same one entry when either Latin picker names it", () => {
    // One catalog, one family, one download: choosing Maple Mono as the app's face and choosing it
    // as the fallback must not fetch two stylesheets.
    expect(
      neededWebfont({ cjkFallback: CJK_FALLBACK_NONE, designFont: "maple", terminalFont: "system" }),
    ).toEqual(MAPLE);
    expect(
      neededWebfont({ cjkFallback: CJK_FALLBACK_NONE, designFont: "aldrich", terminalFont: "maple" }),
    ).toEqual(MAPLE);
  });

  it("needs nothing when no choice names a provider face", () => {
    expect(
      neededWebfont({
        cjkFallback: CJK_FALLBACK_NONE,
        designFont: "aldrich",
        terminalFont: "jetbrains",
      }),
    ).toBeNull();
  });
});

describe("what it writes into the document", () => {
  it("adds one stylesheet and names the family, and is idempotent", () => {
    applyFleetWebfont(MAPLE);
    applyFleetWebfont(MAPLE);
    const links = document.querySelectorAll("#fleet-webfont-stylesheet");
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe(MAPLE.href);
    expect(links[0]?.getAttribute("crossorigin")).toBe("anonymous");
    expect(cjk()).toBe(`"${MAPLE.family}"`);
  });

  it("leaves a name that matches nothing when no face is chosen", () => {
    applyFleetWebfont(MAPLE);
    applyFleetWebfont(null);
    expect(link()).toBeNull();
    // Never empty: an empty value would put two commas together and invalidate every stack.
    expect(cjk().length).toBeGreaterThan(0);
    expect(cjk()).not.toContain(MAPLE.family);
  });
});
