/**
 * Where the keyboard goes after a command.
 *
 * A shortcut is pressed while the operator is typing, and it ends with the caret nowhere: the key
 * was consumed by a capture listener, the command moved the screen, and the focus that was in the
 * composer is now on `body`. The next character they type is lost. So every invocation ends by
 * putting the caret back, under two rules the operator asked for:
 *
 *   - it was in the composer  → back to the SAME offset, because the command was not about the draft
 *   - it was anywhere else    → to the END of the composer, ready to type
 *
 * and a command that MOVED the operator — a new tab, another pane — always lands at the end, because
 * the offset it captured belonged to a draft that is no longer on screen.
 *
 * IT SETTLES RATHER THAN FIRES ONCE. The composer for a pane the operator has just switched to does
 * not exist at the moment the adapter resolves; the route has to load and React has to commit. So
 * this watches for a short window and acts only when the caret is NOT already in a composer — which
 * is also what makes it safe: an operator who starts typing inside that window holds the focus, the
 * condition is false on every remaining tick, and nothing moves under them.
 *
 * A FLEET PANEL OUTRANKS IT. Rename, confirm and the command bar each open a field of their own and
 * own the caret while they are up; seeing one is this giving up, not deferring.
 */

/** Upstream's composer textarea. A `data-slot`, so reading it costs the fork no port. */
const COMPOSER = 'textarea[data-slot="chat-input"]';

/** Any of our own panels. While one is mounted, the caret is its business. */
const PANEL = '[data-slot="fleet-panel"]';

/**
 * How long to keep watching. Long enough for a route change plus a snapshot poll on a slow phone,
 * short enough that a late arrival cannot yank the caret out of a sentence someone has started.
 */
const SETTLE_MS = 800;

/** How often, inside that window. Imperceptible to a person, ~20 querySelectors in total. */
const STEP_MS = 40;

/** A caret, as the two offsets a textarea reports. */
export interface ComposerCaret {
  readonly start: number;
  readonly end: number;
}

export type ComposerFocusMode =
  /** Put the caret back where it was, or at the end when it was not in the composer. */
  | "restore"
  /** Always the end: the draft it was in is not the draft on screen any more. */
  | "end";

function composerInput(doc: Document): HTMLTextAreaElement | null {
  return doc.querySelector<HTMLTextAreaElement>(COMPOSER);
}

/**
 * Where the caret is, read BEFORE the command runs.
 *
 * Answers `null` for "not in the composer", which is the same answer as "no composer on screen" on
 * purpose: both mean the operator was not writing, and both end at the end of the field.
 */
export function captureComposerCaret(): ComposerCaret | null {
  const input = composerInput(document);
  if (input === null || document.activeElement !== input) return null;
  return { start: input.selectionStart, end: input.selectionEnd };
}

/**
 * Return the caret to the composer once the command's effect has settled.
 *
 * Answers a cancel function. Nothing in the app calls it — the window closes itself — but a test
 * that renders and unmounts needs to stop the timer it left running.
 */
export function returnFocusToComposer(
  caret: ComposerCaret | null,
  mode: ComposerFocusMode,
): () => void {
  // THE DOCUMENT IS CAPTURED, not looked up on each tick. A return is scheduled for the page it was
  // scheduled on, and a pending tick must not reach for whatever `document` means when it fires —
  // which, in a test environment torn down between files, is nothing at all. Holding the object is
  // both the narrower meaning and the one that cannot throw.
  const doc = document;
  const deadline = Date.now() + SETTLE_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const tick = () => {
    timer = null;
    if (doc.querySelector(PANEL) !== null) return;

    const input = composerInput(doc);
    // `disabled` is a gone pane, a read-only pane or the idle pause. Focusing it does nothing, so
    // keep waiting instead of spending the one attempt on a field that cannot take the caret.
    if (input !== null && !input.disabled && doc.activeElement !== input) {
      input.focus();
      const at =
        mode === "restore" && caret !== null
          ? // Clamped, because the draft may have been trimmed while the command ran.
            {
              start: Math.min(caret.start, input.value.length),
              end: Math.min(caret.end, input.value.length),
            }
          : { start: input.value.length, end: input.value.length };
      input.setSelectionRange(at.start, at.end);
      // A restore is a single event: the caret is back where it was and the operator carries on.
      // A move keeps watching, because the pane it is moving to may still be replacing this node.
      if (mode === "restore") return;
    }

    if (Date.now() >= deadline) return;
    timer = setTimeout(tick, STEP_MS);
  };

  // One turn of the loop before the first look, so React has committed whatever the adapter did.
  timer = setTimeout(tick, 0);
  return stop;
}
