// opencode's paste summary. A paste (bracketed, or a PTY read its editor takes for one) that is longer
// than PASTE_COLLAPSE_CHARS or spans PASTE_COLLAPSE_LINES lines is not inserted literally: the box
// shows `[Pasted ~N lines]` and the text travels with the token, expanded again on submit. Anything
// shorter is inserted as typed.
//
// Live-probed on opencode 1.19.0 (2026-10-11, herdr 0.9.1, bracketed): 150 chars on one line literal,
// 151 a token; 60 chars over 2 lines literal, over 3 lines a token; N is the line count of the paste
// (5000 chars with 0/1/2 newlines: ~1/~2/~3 lines; 20000 chars with 7 newlines: ~8 lines).
//
// Why the adapter sends a collapsing reply as ONE such paste instead of typing it: opencode re-lays
// the whole draft out for every character it inserts, and the cost grows with the draft. Typed in
// 512-char parts, a 4.6KB URL (no spaces, so one unbreakable word) took 2.8s to echo the
// part that brought the draft to 2.5KB and 8.0s for the one that brought it to 4.1KB — each echo
// arriving as a single repaint at the end, long past the guard's ~2.5s verify window, so the send
// stalled with the text sitting in the box. The same 5000 chars as one paste show their token in
// 0.4s.

const PASTE_COLLAPSE_CHARS = 150;
const PASTE_COLLAPSE_LINES = 3;
const PASTE_TOKEN = /^\[Pasted ~(\d+) lines\]$/;

/** The paste as opencode measures it: CRLF and lone CR folded to LF, outer whitespace dropped
 *  (packages/tui/src/component/prompt/index.tsx at v1.19.0). */
function pasted(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function lineCount(pastedText: string): number {
  let n = 1;
  for (const ch of pastedText) if (ch === "\n") n++;
  return n;
}

/**
 * Whether opencode summarises this text when it arrives as one paste — and therefore whether the
 * reply is sent as ONE bracketed paste rather than typed (`HarnessAdapter.bracketedPaste`, and the
 * single-part branch of `opencodeReplyChunks`). A text under both limits is inserted literally either
 * way, so it keeps the typed path and its literal-echo verification.
 */
export function collapsesAsPaste(text: string): boolean {
  const p = pasted(text);
  return p.length > PASTE_COLLAPSE_CHARS || lineCount(p) >= PASTE_COLLAPSE_LINES;
}

/**
 * The adapter's second look at a draft the literal match could not vouch for
 * (`HarnessAdapter.draftCarriesSend`): true only when the box holds exactly one paste token and
 * nothing else, the send is one opencode would have summarised, and the token's line count is this
 * send's. Any literal text beside it is a screen we do not understand, and the send stalls as before
 * rather than firing Enter at it.
 *
 * The token names a line count and nothing else, so one left by an earlier paste reads the same as
 * ours, and the pre-type sweep that would have removed it is skipped whenever the composer's mirror
 * shows no draft. `before` closes that: a box the guard read as already holding something cannot
 * vouch for this send. A paste landing beside an old token makes two, which is not a lone token.
 */
export function pasteCarriesSend(sent: string, draft: string, before?: string | null): boolean {
  if (before !== undefined && before !== null) return false;
  if (!collapsesAsPaste(sent)) return false;
  const token = PASTE_TOKEN.exec(draft.trim());
  return token !== null && Number(token[1]) === lineCount(pasted(sent));
}

/** Whether the draft is nothing but opencode's paste token (`HarnessAdapter.draftIsOpaque`): the
 *  stranded-draft preview must not offer to take `[Pasted ~1 lines]` over as if it were the message. */
export function isPasteTokenOnly(draft: string): boolean {
  return PASTE_TOKEN.test(draft.trim());
}
