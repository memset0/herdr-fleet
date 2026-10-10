import {
  CJK_FALLBACK_UNSET_FAMILY,
  fleetWebfont,
  FLEET_WEBFONTS,
  type FleetWebfont,
} from "../../../fleet/ui/webfonts.ts";

/**
 * The DOM half of the Fleet webfont seam: independent idempotent UI/fallback links and one fallback property.
 *
 * Everything that decides WHICH face lives in `fleet/ui/webfonts.ts` as data; this file only writes
 * what it is handed. The two things it writes are the two things a font stack needs — the rules that
 * declare the family, and the name that puts it in the stack — and nothing here builds a stack:
 * `index.css` owns every one of those, and `var(--font-cjk)` is the one hole they leave.
 */

const LINK_ID = "fleet-webfont-stylesheet";
const CJK_PROPERTY = "--font-cjk";

/** Reuse each role's stylesheet and never disturb the other role. */
function applyStylesheet(id: string, font: FleetWebfont | null): void {
  const current = document.getElementById(id);
  if (font === null) { current?.remove(); return; }
  if (current instanceof HTMLLinkElement) {
    if (current.href !== font.href) current.href = font.href;
    return;
  }
  const element = document.createElement("link");
  element.id = id;
  element.rel = "stylesheet";
  element.crossOrigin = "anonymous";
  element.referrerPolicy = "no-referrer";
  element.href = font.href;
  document.head.append(element);
}

export function applyFleetWebfont(font: FleetWebfont | null): void {
  applyStylesheet(LINK_ID, font);
  document.documentElement.style.setProperty(CJK_PROPERTY, `"${font?.family ?? CJK_FALLBACK_UNSET_FAMILY}"`);
}

export function applyFleetUiWebfont(font: FleetWebfont | null): void {
  applyStylesheet("fleet-ui-webfont-stylesheet", font);
}

/** The primary UI sheet, unless the fallback sheet already supplies that face. */
export function neededUiWebfont(designFont: string, fallback: FleetWebfont | null): FleetWebfont | null {
  const chosen = FLEET_WEBFONTS.find(font => font.uiKey === designFont) ?? null;
  return chosen?.id === fallback?.id ? null : chosen;
}

/**
 * The face the document needs, given every choice that can name one.
 *
 * All three resolve to the same catalog, so a device that picks Maple Mono as its terminal face and
 * a device that picks it as a CJK fallback fetch one stylesheet between them.
 */
export function neededWebfont(input: {
  cjkFallback: string;
  designFont: string;
  terminalFont: string;
}): FleetWebfont | null {
  const chosen = fleetWebfont(input.cjkFallback);
  if (chosen?.monospace) return chosen;
  // The Latin pickers name the same family under a shorter key; both are the one catalog entry.
  if (input.designFont === "maple" || input.terminalFont === "maple") {
    return fleetWebfont("maple-mono-cn");
  }
  return null;
}
