import {
  CJK_FALLBACK_UNSET_FAMILY,
  fleetWebfont,
  type FleetWebfont,
} from "../../../fleet/ui/webfonts.ts";

/**
 * The DOM half of the Fleet webfont seam: one `<link>` and one custom property, both idempotent.
 *
 * Everything that decides WHICH face lives in `fleet/ui/webfonts.ts` as data; this file only writes
 * what it is handed. The two things it writes are the two things a font stack needs — the rules that
 * declare the family, and the name that puts it in the stack — and nothing here builds a stack:
 * `index.css` owns every one of those, and `var(--font-cjk)` is the one hole they leave.
 */

const LINK_ID = "fleet-webfont-stylesheet";
const CJK_PROPERTY = "--font-cjk";

/** The element is REUSED rather than recreated, so switching faces never drops the old one's rules
 *  mid-paint and never leaves two stylesheets fighting over one family name. */
function link(): HTMLLinkElement | null {
  const existing = document.getElementById(LINK_ID);
  if (existing instanceof HTMLLinkElement) return existing;
  return null;
}

/**
 * Make the document's webfont state match `font`: `null` removes both writes.
 *
 * Safe to call on every render — it compares before it writes, so a no-op costs two property reads.
 * Called only from an effect, so a document is a precondition rather than something to test for.
 */
export function applyFleetWebfont(font: FleetWebfont | null): void {
  const root = document.documentElement;
  const current = link();

  if (font === null) {
    current?.remove();
    // The stack keeps its shape and simply falls through: the unset name matches nothing.
    root.style.setProperty(CJK_PROPERTY, `"${CJK_FALLBACK_UNSET_FAMILY}"`);
    return;
  }

  if (current === null) {
    const element = document.createElement("link");
    element.id = LINK_ID;
    element.rel = "stylesheet";
    // The provider is third-party and the sheet is public: ask for it without credentials, and let
    // the app's own `referrer-policy: no-referrer` keep the private origin out of the request.
    element.crossOrigin = "anonymous";
    element.href = font.href;
    document.head.append(element);
  } else if (current.href !== font.href) {
    current.href = font.href;
  }

  const family = `"${font.family}"`;
  if (root.style.getPropertyValue(CJK_PROPERTY) !== family) {
    root.style.setProperty(CJK_PROPERTY, family);
  }
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
  if (chosen !== null) return chosen;
  // The Latin pickers name the same family under a shorter key; both are the one catalog entry.
  if (input.designFont === "maple" || input.terminalFont === "maple") {
    return fleetWebfont("maple-mono-cn");
  }
  return null;
}
