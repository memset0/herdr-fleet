/**
 * Codex's status row as a headless Codex draws it, read as the status row it is.
 *
 * A Codex whose colour queries went unanswered (no client attached when it started, #294) keeps its
 * item colours but loses the theme's muted tone. With a multi-item `status_line` that changes how the
 * row splits into segments, in three ways upstream's paint test (`harness/codex/markers.ts`,
 * `isStyledStatusRow`) does not expect:
 *
 *   1. From the fourth item on, the space before a separator is painted in the item's colour, so the
 *      item arrives as `main␠` and the separator as `· ` instead of ` · `.
 *   2. The gap before a right-aligned notice and the notice's `⚠ ` would differ in paint on a
 *      coloured screen; with no muted tone both are unpainted, so they arrive as ONE segment `  ⚠ `.
 *   3. The notice's glue text (`⚠ `, ` · `, `to view`) and its bold key carry no colour at all.
 *
 * `withFleetCodexStatusSegments` repairs the first two before upstream's loop reads the row, and
 * `fleetReadsUnpaintedNotice` decides the third for upstream's notice check
 * (FORK.toml `codex-headless-status-row-port`). Every other rule stays upstream's.
 *
 * TEMPORARY. A compatibility port, removed at the first upstream sync that adopts a release in which
 * upstream reads headless multi-item status rows itself.
 */

import type { AnsiSegment } from "./ansi";

const SEPARATOR_TAIL = "· ";
const GLUED_GAP = /^( {2,})(\S[\s\S]*)$/;
const TRAILING_SPACE = /\S $/;

function isUnpainted(segment: AnsiSegment): boolean {
  return (
    segment.fg === undefined &&
    segment.bg === undefined &&
    segment.bold !== true &&
    segment.dim !== true &&
    segment.italic !== true &&
    segment.underline !== true
  );
}

/**
 * The folded status-row segments with the two headless splits repaired: an unpainted run of two or
 * more spaces glued to the text after it (never the row's first segment) is split into the gap and
 * the text, and a coloured item's single trailing space is given back to a directly following `· `,
 * which becomes ` · ` in its own paint. Every other segment is copied as it is. A new list; the input
 * is never modified. `null` (nothing survived folding) passes through.
 */
export function withFleetCodexStatusSegments(segments: AnsiSegment[] | null): AnsiSegment[] | null {
  if (segments === null) return null;
  const out: AnsiSegment[] = [];
  for (const segment of segments) {
    const glued = out.length > 0 && isUnpainted(segment) ? GLUED_GAP.exec(segment.text) : null;
    if (glued === null) out.push({ ...segment });
    else out.push({ ...segment, text: glued[1]! }, { ...segment, text: glued[2]! });
  }
  for (let i = 0; i + 1 < out.length; i++) {
    const item = out[i]!;
    const separator = out[i + 1]!;
    if (item.fg === undefined || separator.text !== SEPARATOR_TAIL || !TRAILING_SPACE.test(item.text)) continue;
    out[i] = { ...item, text: item.text.slice(0, -1) };
    out[i + 1] = { ...separator, text: ` ${SEPARATOR_TAIL}` };
  }
  return out;
}

/**
 * Whether a right-aligned notice may carry a segment with neither a colour nor SGR 2, given the paint
 * the row's own separators carry (`markers.ts` `separatorPaint`). Only on a `plain` row: there the
 * theme answer was missing, and an uncoloured notice is what that looks like. A row whose separators
 * carry a colour or SGR 2 keeps upstream's rule that every notice segment is painted.
 */
export function fleetReadsUnpaintedNotice(separatorPaint: string | null): boolean {
  return separatorPaint === "plain";
}
