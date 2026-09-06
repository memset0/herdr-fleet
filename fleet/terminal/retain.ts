/**
 * The most recent output of a held session, kept so a browser that comes back has something to draw.
 *
 * This exists for exactly one case and is deliberately too small to be mistaken for another. When a
 * session is newly established the multiplexer sends the whole current screen as its first frame, so
 * a browser attaching then needs nothing from here. It is only when a session was *held* through its
 * grace period — the terminal already attached, no new repaint coming — that a returning browser has
 * no picture, and this is what it gets instead.
 *
 * It is not scrollback and must not be presented as any. Scrollback is the terminal's, it is bounded
 * by the terminal, and an agent Pane runs on the alternate screen where there is none at all. This is
 * a window of bytes that happened recently, which is a different thing and a smaller promise.
 *
 * Bytes, not text: a UTF-8 sequence can straddle two frames, and decoding here would produce two
 * replacement characters where the terminal would have produced one glyph.
 */

export interface RetainedWindow {
  /** Append output that has just been forwarded to whoever is attached. */
  push(chunk: Uint8Array): void;
  /** Everything retained, oldest first, as one buffer. Empty when nothing has been retained. */
  replay(): Uint8Array;
  /** Retained size in bytes, for diagnostics and for tests that assert the bound. */
  size(): number;
  /** Forget everything — used when a session ends, so a later one cannot inherit its screen. */
  clear(): void;
}

/**
 * A byte-bounded ring.
 *
 * The bound is on bytes rather than on frames because frames are whatever the terminal happened to
 * flush: a program printing one character at a time and one printing a full screen would otherwise
 * get wildly different amounts of history for the same number of frames.
 *
 * Oldest first, and a single chunk larger than the whole bound keeps its *tail* rather than being
 * dropped: the newest bytes are the ones a returning browser needs, and the tail of a repaint is
 * closer to the current screen than its head.
 */
export function retainedWindow(maxBytes: number): RetainedWindow {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("retained window bound must be a positive integer");
  }
  let chunks: Uint8Array[] = [];
  let total = 0;

  const trim = (): void => {
    while (total > maxBytes && chunks.length > 0) {
      const oldest = chunks[0]!;
      if (total - oldest.length >= maxBytes) {
        chunks.shift();
        total -= oldest.length;
        continue;
      }
      // The oldest chunk straddles the bound: keep only the part that fits, so the window is exactly
      // bounded rather than bounded-to-the-nearest-frame.
      const drop = total - maxBytes;
      chunks[0] = oldest.subarray(drop);
      total -= drop;
    }
  };

  return {
    push(chunk) {
      if (chunk.length === 0) return;
      // A chunk bigger than the whole window can only contribute its tail; keeping the head would
      // hand a browser the top of a repaint and none of the current screen.
      const kept = chunk.length > maxBytes ? chunk.subarray(chunk.length - maxBytes) : chunk;
      chunks.push(kept);
      total += kept.length;
      trim();
    },
    replay() {
      if (total === 0) return new Uint8Array();
      const out = new Uint8Array(total);
      let at = 0;
      for (const chunk of chunks) {
        out.set(chunk, at);
        at += chunk.length;
      }
      return out;
    },
    size() {
      return total;
    },
    clear() {
      chunks = [];
      total = 0;
    },
  };
}
