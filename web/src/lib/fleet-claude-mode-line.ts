/**
 * Claude Code's own key hints on its mode line, which are not dialog key hints.
 *
 * From Claude Code 2.1.286 the mode line under the input box grows a suffix while background agents
 * or tasks run, and, while the main turn is working too, an interrupt hint in front of it:
 *
 *     ⏵⏵ bypass permissions on (shift+tab to cycle) · ← 2 agents · ↓ to manage
 *     ⏵⏵ bypass permissions on (shift+tab to cycle) · esc to interrupt · ← for agents · ↓ to manage
 *
 * and a narrow pane clips the end to `↓ to ma…`. Upstream's Claude grammar asks `namesAMenuKey` of
 * every row under the box and of the screen's last rows, and `↓` and `esc` are keys it can send — so
 * these segments read as a modal's footer hints, the box is refused, and a healthy working screen is
 * covered by the unread-dialog card. The two upstream checks pass each row through
 * `withoutClaudeManageHint` first (FORK.toml `claude-manage-hint-port`); this file is the whole of
 * the decision.
 *
 * TEMPORARY. A compatibility port for Claude Code 2.1.286, removed at the first upstream sync that
 * adopts a release in which upstream reads these hints itself.
 *
 * NARROW ON PURPOSE. On the mode line split by upstream's own separator (a notice Claude
 * right-aligned on the same row is set aside first, and kept), and only when the FIRST segment is
 * the permission-mode text — one or more `⏵`/`⏸` glyphs, words, `on`, and optionally
 * `(shift+tab to cycle)`, the shape of every mode line upstream's corpus carries — two hints go:
 *
 *   - `esc to interrupt`, wherever it stands after the mode text;
 *   - `↓ to manage`, only as the LAST segment.
 *
 * Either is matched whole and case-sensitively, or — as the last segment only, where the terminal
 * clips — cut short with `…` but no shorter than `<key> to`. Anything else is returned unchanged, so
 * a `↓ to manage` or `Esc to cancel` in a dialog footer keeps upstream's reading, and so does every
 * other segment of the mode line itself.
 */

import { SEGMENT_SPLIT } from "./harness/menu-hints";

const MODE_TEXT = /^[⏵⏸]+\s+[a-z][a-z ]*\bon(?:\s+\(shift\+tab to cycle\))?$/i;
const INTERRUPT = "esc to interrupt";
const MANAGE = "↓ to manage";
// Claude right-aligns a notice on the same row, after a run of padding. The mode line itself is
// written with single spaces, so the first run of two or more ends it.
const PADDING = /\s{2,}/;

/** Whether `segment` is `hint` cut short by the terminal with `…`, keeping at least `<key> to`. */
function isClipOf(segment: string, hint: string): boolean {
  if (!segment.endsWith("…")) return false;
  const clip = segment.slice(0, -1).trimEnd();
  return clip.length >= hint.indexOf(" to ") + " to".length && hint.startsWith(clip);
}

/** Whether a mode-line segment after the mode text is one of Claude's own hints. */
function isModeLineHint(segment: string, last: boolean): boolean {
  if (segment === INTERRUPT) return true;
  if (!last) return false;
  return segment === MANAGE || isClipOf(segment, MANAGE) || isClipOf(segment, INTERRUPT);
}

/**
 * `text` without Claude's own mode-line hints (`esc to interrupt`, a trailing `↓ to manage`) when
 * `text` is the mode line carrying them; otherwise `text` itself. A right-aligned notice after the
 * line is kept, so upstream still reads it.
 */
export function withoutClaudeManageHint(text: string): string {
  const indent = /^\s*/.exec(text)![0];
  const body = text.slice(indent.length);
  const padding = PADDING.exec(body);
  const modeLine = padding === null ? body : body.slice(0, padding.index);
  const notice = padding === null ? "" : body.slice(padding.index);

  const segments = modeLine.split(SEGMENT_SPLIT);
  if (segments.length < 2 || !MODE_TEXT.test(segments[0]!)) return text;
  const kept = segments.filter((segment, i) => i === 0 || !isModeLineHint(segment, i === segments.length - 1));
  if (kept.length === segments.length) return text;
  return indent + kept.join(" · ") + notice;
}
