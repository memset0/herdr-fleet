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
    // A PENDING PREFIX OUTRANKS THIS, and the two are in direct contradiction: parking exists to keep
    // the caret OFF the composer, and this loop exists to put it back. A settle window opened by an
    // earlier command outlives that command by up to `SETTLE_MS`, so without this a prefix armed
    // inside that window is un-parked a frame later — and the second chord goes straight back to the
    // input method, intermittently, depending on which command was run just before.
    //
    // It stops rather than waits: unparking does its own restore, through this same function.
    if (parkedCaret !== null) return;

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

/**
 * PARKING: getting the caret out of the way while a prefix is pending.
 *
 * An input method composes into the FOCUSED EDITABLE ELEMENT. A key it has claimed for a composition
 * reaches the page either not at all or without the physical code a binding is matched on — so the
 * capture-phase listener, which preempts every other surface, does not preempt an IME. Nothing about
 * the listener can: by the time the event would arrive, the key is already spent.
 *
 * So the condition is removed rather than arbitrated. With no editable element focused there is no
 * composition for the key to disappear into, and the second chord arrives as an ordinary keydown.
 *
 * NOT WHILE A COMPOSITION IS IN FLIGHT. Moving focus then commits or discards a partly-typed word,
 * which is a far worse thing to do to somebody than failing to recognise their shortcut.
 *
 * The caret taken here is remembered rather than returned, because the two callers that need it —
 * the dispatcher and the panel — both run after the composer has already lost it and would otherwise
 * read `null` and land at the end of the field.
 */

const PARKED_SLOT = "fleet-key-park";

/** The caret taken when the prefix armed, or `null` when nothing is parked. */
let parkedCaret: ComposerCaret | null = null;
let parkedElement: HTMLElement | null = null;

/**
 * True while an input method is composing anywhere on the page.
 *
 * Maintained from the provider's own capture-phase composition listeners rather than read off the
 * composer, because the composer is Collie's file and this needs no port into it: `compositionstart`
 * and `compositionend` bubble, and the layer that already owns a document-level key listener can own
 * two more without anything upstream knowing.
 */
let composing = false;

/** Told by the provider. The only writer. */
export function noteComposition(active: boolean): void {
  composing = active;
}

/**
 * Take the caret out of the composer. Answers whether anything was parked.
 *
 * Idempotent: arming a prefix twice — which a hand does when it is not sure the first press landed —
 * must not overwrite the remembered caret with the parked element's non-caret.
 */
export function parkCaretForPrefix(): boolean {
  // ALREADY PARKED: keep the offset the first press took — a hand presses the prefix twice when it
  // is not sure the first one landed — and make sure focus is still off the composer, because a
  // re-render between the two presses can put it back.
  if (parkedCaret !== null) {
    const slot = ensureParkSlot();
    parkedElement = slot;
    if (document.activeElement !== slot) slot.focus();
    return true;
  }

  const input = composerInput(document);
  if (input === null || document.activeElement !== input) return false;
  // A composition in flight outranks the whole idea: moving focus now commits or discards a
  // partly-typed word, which is a far worse thing to do to somebody than missing their shortcut.
  if (composing) return false;

  const caret = { start: input.selectionStart, end: input.selectionEnd };
  const slot = ensureParkSlot();
  parkedCaret = caret;
  parkedElement = slot;
  slot.focus();
  return true;
}

/**
 * The element the caret is parked on, created once and re-attached if it has been detached.
 *
 * The re-attachment is not defensive tidiness: a slot that has left the document can still be
 * focused by name and silently does nothing, which would make every park after the first a no-op and
 * hand the second chord straight back to the input method.
 */
function ensureParkSlot(): HTMLElement {
  const existing = document.querySelector<HTMLElement>(`[data-slot="${PARKED_SLOT}"]`);
  if (existing !== null && existing.isConnected) return existing;
  const slot = existing ?? document.createElement("div");
  slot.setAttribute("data-slot", PARKED_SLOT);
  // Focusable but not editable, and out of the reading order: an input method has nothing to compose
  // into, and a screen reader has nothing new to announce.
  slot.tabIndex = -1;
  slot.setAttribute("aria-hidden", "true");
  slot.style.position = "fixed";
  slot.style.width = "1px";
  slot.style.height = "1px";
  slot.style.opacity = "0";
  slot.style.pointerEvents = "none";
  document.body.append(slot);
  return slot;
}

/** Whether this element is the one the caret was parked on. */
export function isParkedElement(element: Element | null): boolean {
  return element !== null && element === parkedElement;
}

/** The caret the prefix took, for a caller that would otherwise read a parked composer. */
export function parkedCaretForPrefix(): ComposerCaret | null {
  return parkedCaret;
}

/**
 * Give the caret back, at the offset the prefix took it from.
 *
 * `mode` is the caller's, because a command that moved the operator to another Pane wants the end of
 * the field it landed on rather than an offset that described a draft now off screen.
 */
export function unparkCaretForPrefix(mode: ComposerFocusMode = "restore"): void {
  if (parkedCaret === null) return;
  const caret = parkedCaret;
  parkedElement = null;
  parkedCaret = null;
  returnFocusToComposer(mode === "end" ? null : caret, mode);
}

/** Drop the parked state without moving anything. For a test, and for a torn-down document. */
export function __resetCaretPark(): void {
  parkedElement = null;
  parkedCaret = null;
  composing = false;
}
