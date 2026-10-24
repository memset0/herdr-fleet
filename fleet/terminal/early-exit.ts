/**
 * A terminal that exits as it starts, and the one thing it printed that can say why.
 *
 * Everything else in this capability keeps terminal content out of diagnostics, and that rule stands.
 * This file is its single, bounded exception, and it exists because of a measured failure: an
 * attachment that exits within a millisecond of opening prints its reason into its own pty, so that
 * reason reaches the Gateway as terminal output just before the close and was otherwise thrown away.
 * Without it the log says only `upstream-exit`, and the operator sees only "ended".
 *
 * So for the first few seconds of a session — and only then — its output is also kept in a small
 * buffer. If the session ends inside that window, the buffer becomes a short line of printable text:
 * the log line gains it, and so does the browser. The first output after the window drops the buffer
 * for good, so a session anybody actually used never has a byte of it retained for this purpose.
 *
 * Pure on purpose: the browser imports the window from here, and the sanitizer is tested by itself.
 */

/** How long after a session opens an `upstream-exit` still counts as exiting "as it starts". */
export const EARLY_EXIT_WINDOW_MS = 5_000;

/** The most raw output kept while inside the window; the newest bytes win. */
export const EARLY_TAIL_BYTES = 4_096;

/** The most characters of printable text the tail may carry. */
export const EARLY_TAIL_CHARS = 300;

const ESC = 0x1b;
const BEL = 0x07;
const DEL = 0x7f;

const decoder = new TextDecoder("utf-8", { fatal: false });

function isWhitespaceControl(code: number): boolean {
  return code === 0x09 || code === 0x0a || code === 0x0d;
}

/** Where an escape sequence ends, and whether it leaves a gap between the words around it. */
interface EscapeSpan {
  readonly end: number;
  readonly gap: boolean;
}

/**
 * Where an escape sequence that starts at `start` ends, and whether it should leave a gap behind.
 *
 * A gap, because a cursor movement between two words is what separated them on screen; colour and
 * the string sequences (titles, hyperlinks, device control) separate nothing and leave none. A
 * sequence the chunk ends inside is consumed to the end: half a sequence is not text.
 */
function skipEscape(text: string, start: number): EscapeSpan {
  const introducer = text.charCodeAt(start + 1);
  if (Number.isNaN(introducer)) return { end: text.length, gap: false };
  // CSI: parameters, intermediates, then one final byte.
  if (introducer === 0x5b) {
    let at = start + 2;
    while (at < text.length && text.charCodeAt(at) >= 0x30 && text.charCodeAt(at) <= 0x3f) at += 1;
    while (at < text.length && text.charCodeAt(at) >= 0x20 && text.charCodeAt(at) <= 0x2f) at += 1;
    if (at >= text.length) return { end: text.length, gap: false };
    const final = text.charCodeAt(at);
    if (final >= 0x40 && final <= 0x7e) return { end: at + 1, gap: final !== 0x6d };
    // Malformed: drop the introducer and read on from the byte that broke it.
    return { end: at, gap: true };
  }
  // OSC, DCS, SOS, PM, APC: a string ended by ST, or (OSC only, in practice) by BEL.
  if (introducer === 0x5d || introducer === 0x50 || introducer === 0x58 || introducer === 0x5e || introducer === 0x5f) {
    for (let at = start + 2; at < text.length; at += 1) {
      const code = text.charCodeAt(at);
      if (code === BEL) return { end: at + 1, gap: false };
      if (code === ESC && text.charCodeAt(at + 1) === 0x5c) return { end: at + 2, gap: false };
    }
    return { end: text.length, gap: false };
  }
  // Character-set designations and their kin take one more byte.
  if (introducer >= 0x20 && introducer <= 0x2f) return { end: Math.min(text.length, start + 3), gap: false };
  return { end: start + 2, gap: false };
}

/**
 * The printable text in some terminal output: decoded, every control and escape sequence removed,
 * line breaks and tabs read as spaces, whitespace runs collapsed, and only the last `limit`
 * characters kept, marked with a leading ellipsis when cut.
 */
export function sanitizeTail(bytes: Uint8Array, limit = EARLY_TAIL_CHARS): string {
  const text = decoder.decode(bytes);
  let out = "";
  let at = 0;
  while (at < text.length) {
    const code = text.charCodeAt(at);
    if (code === ESC) {
      const skipped = skipEscape(text, at);
      if (skipped.gap) out += " ";
      at = skipped.end;
      continue;
    }
    if (isWhitespaceControl(code)) out += " ";
    // C0, DEL, C1, and the decoder's replacement for a byte that was not text.
    else if (code >= 0x20 && code !== DEL && (code < 0x80 || code > 0x9f) && code !== 0xfffd) out += text.charAt(at);
    at += 1;
  }
  const characters = Array.from(out.replace(/\s+/g, " ").trim());
  if (characters.length <= limit) return characters.join("");
  return `…${characters.slice(characters.length - (limit - 1)).join("")}`;
}

/**
 * The bounded early-window capture one session keeps.
 *
 * Holds at most `EARLY_TAIL_BYTES`, newest last, and only while inside the window. The first output
 * after the window — or `take`, whichever comes first — discards it, and nothing reopens it.
 */
export class EarlyTail {
  private held: Uint8Array | null = new Uint8Array(0);
  private readonly startedAt: number;
  private readonly windowMs: number;
  private readonly maxBytes: number;

  constructor(startedAt: number, windowMs = EARLY_EXIT_WINDOW_MS, maxBytes = EARLY_TAIL_BYTES) {
    this.startedAt = startedAt;
    this.windowMs = windowMs;
    this.maxBytes = maxBytes;
  }

  /** Whether `now` is still inside this session's early window. */
  within(now: number): boolean {
    return now - this.startedAt <= this.windowMs;
  }

  /** Bytes currently retained; zero once the window has passed. */
  size(): number {
    return this.held?.length ?? 0;
  }

  /** How long the session has lived at `now`, in whole milliseconds. */
  lifetime(now: number): number {
    return Math.max(0, Math.round(now - this.startedAt));
  }

  push(data: Uint8Array, now: number): void {
    const held = this.held;
    if (held === null) return;
    if (!this.within(now)) {
      this.held = null;
      return;
    }
    if (data.length >= this.maxBytes) {
      this.held = data.slice(data.length - this.maxBytes);
      return;
    }
    const keep = Math.min(held.length, this.maxBytes - data.length);
    const next = new Uint8Array(keep + data.length);
    next.set(held.subarray(held.length - keep), 0);
    next.set(data, keep);
    this.held = next;
  }

  /** The sanitized tail when the session ends inside its window, `null` otherwise. Discards either way. */
  take(now: number): string | null {
    const held = this.held;
    this.held = null;
    if (held === null || !this.within(now)) return null;
    return sanitizeTail(held);
  }
}
