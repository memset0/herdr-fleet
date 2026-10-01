/**
 * Claude Code's background-work hint on its mode line, which is not a dialog key hint.
 *
 * From Claude Code 2.1.286 the mode line under the input box grows a suffix while background agents
 * or tasks run:
 *
 *     ⏵⏵ bypass permissions on (shift+tab to cycle) · ← 2 agents · ↓ to manage
 *
 * and a narrow pane clips it to `↓ to ma…`. Upstream's Claude grammar asks `namesAMenuKey` of every
 * row under the box and of the screen's last rows, and `↓` is a key it can send — so this one segment
 * reads as a modal's footer hint, the box is refused, and a healthy working screen is covered by the
 * unread-dialog card. The two upstream checks pass each row through `withoutClaudeManageHint` first
 * (FORK.toml `claude-manage-hint-port`); this file is the whole of the decision.
 *
 * TEMPORARY. A compatibility port for Claude Code 2.1.286, removed at the first upstream sync that
 * adopts a release in which upstream reads this hint itself.
 *
 * NARROW ON PURPOSE. The segment is removed only when all three hold, on the mode line split by
 * upstream's own separator (a notice Claude right-aligned on the same row is set aside first, and kept):
 *
 *   - the FIRST segment is the permission-mode text — one or more `⏵`/`⏸` glyphs, words, `on`, and
 *     optionally `(shift+tab to cycle)`, the shape of every mode line upstream's corpus carries;
 *   - the segment before the LAST is `← <digits> agent(s)`;
 *   - the LAST segment is `↓ to manage`, or a clip of it no shorter than `↓ to` ending in `…`.
 *
 * Anything else is returned unchanged, so a `↓ to <verb>` in a dialog footer keeps upstream's
 * reading, and so does every other segment of the mode line itself.
 */

import { SEGMENT_SPLIT } from "./harness/menu-hints";

const SEPARATOR = /\s+·\s+/g;
const MODE_TEXT = /^[⏵⏸]+\s+[a-z][a-z ]*\bon(?:\s+\(shift\+tab to cycle\))?$/i;
const AGENT_COUNT = /^←\s+\d+\s+agents?$/;
const HINT = "↓ to manage";
const SHORTEST_CLIP = "↓ to";
// Claude right-aligns a notice on the same row, after a run of padding. The mode line itself is
// written with single spaces, so the first run of two or more ends it.
const PADDING = /\s{2,}/;

/** Whether a segment is the hint, whole or clipped by the terminal with `…`. */
function isManageHint(segment: string): boolean {
  if (segment === HINT) return true;
  if (!segment.endsWith("…")) return false;
  const clip = segment.slice(0, -1).trimEnd();
  return clip.length >= SHORTEST_CLIP.length && HINT.startsWith(clip);
}

/**
 * `text` without Claude's trailing `· ↓ to manage` background-work hint when `text` is the mode line
 * carrying it; otherwise `text` itself. A right-aligned notice after the hint is kept, so upstream
 * still reads it.
 */
export function withoutClaudeManageHint(text: string): string {
  const indent = /^\s*/.exec(text)![0];
  const body = text.slice(indent.length);
  const padding = PADDING.exec(body);
  const modeLine = padding === null ? body : body.slice(0, padding.index);
  const notice = padding === null ? "" : body.slice(padding.index);

  const segments = modeLine.split(SEGMENT_SPLIT);
  if (segments.length < 3) return text;
  if (!MODE_TEXT.test(segments[0]!)) return text;
  if (!AGENT_COUNT.test(segments[segments.length - 2]!)) return text;
  if (!isManageHint(segments[segments.length - 1]!)) return text;

  const separators = [...modeLine.matchAll(SEPARATOR)];
  return indent + modeLine.slice(0, separators[separators.length - 1]!.index) + notice;
}
