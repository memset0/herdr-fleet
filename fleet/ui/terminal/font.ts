/**
 * The family a terminal is drawn AND MEASURED with.
 *
 * The terminal surface has to answer the same question the mirror answers — which face renders a
 * Pane's text — and it has to answer it identically, because they are two views of one thing and an
 * operator who chose a face chose it for the Pane, not for one of its surfaces.
 *
 * It matters more here than in the mirror, and for a reason worth stating. The mirror is flowed
 * text: a Latin face and a CJK face with different advances make a line that is slightly ragged and
 * still readable. A terminal is a GRID. The emulator measures one cell from the Latin advance and
 * then assumes every wide character is exactly two of them — so a CJK face whose advance is not
 * twice the Latin one does not look ragged, it looks broken, and every column after the first
 * Chinese character on a line is in the wrong place.
 *
 * That is what `var(--font-cjk)` is for, and why it has to be RESOLVED here rather than passed
 * through: the emulator takes a family list as a string and measures with it, and a stack still
 * carrying `var(...)` measures whatever the browser makes of an unresolvable term.
 */

/** Reads a custom property off the document root. Injected so this file needs no DOM to be tested. */
export type ReadProperty = (property: string) => string;

const CJK_TERM = "var(--font-cjk)";

/**
 * The family list for the terminal, from the operator's own two settings.
 *
 * `chosen` is the stack their terminal-font choice resolves to, or undefined for the default — in
 * which case the app's own `--font-mono` is the answer, exactly as it is for a mirror that was never
 * configured. Either way the CJK term is substituted, and dropped rather than left empty when the
 * fallback is off: an empty entry in a family list is a parse error, and a browser that meets one
 * discards the rest of the list.
 */
export function terminalFontFamily(chosen: string | undefined, read: ReadProperty): string {
  const stack = (chosen ?? read("--font-mono")).trim();
  if (stack === "") return "monospace";
  const cjk = read("--font-cjk").trim();
  const substituted = stack
    .split(",")
    .map((entry) => (entry.trim() === CJK_TERM ? cjk : entry.trim()))
    .filter((entry) => entry !== "");
  // Always ends somewhere real: a stack whose every entry was a family this device does not have is
  // still a stack, but one with nothing generic at the end leaves the choice to the browser.
  if (!substituted.includes("monospace")) substituted.push("monospace");
  return substituted.join(", ");
}
