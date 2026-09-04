/**
 * WAS THIS SURFACE OPENED BY A RIGHT-CLICK, AND WHERE?
 *
 * The row actions the hierarchy, the tab strip and the pane strip all open are ONE pair of sheets
 * (Collie's `PaneActionsSheet` and `TabActionsSheet`), reached through one hook — `useLongPress`,
 * which already treats a `contextmenu` as an alternative trigger so a phone's long press and a
 * pointer's right-click land in the same place. What it does not carry is the POINT: its callback
 * takes no arguments, and three call sites would each have to grow one to pass it.
 *
 * So the gesture is recorded here instead, once, from a capture-phase listener, and CLAIMED by
 * whichever surface opens next. That is a deliberate trade — a claim by timing rather than by
 * identity — and these are the bounds that make it safe:
 *
 *  · **A mouse only.** Android raises `contextmenu` at the end of a long press, and a phone must
 *    keep the bottom sheet. The last pointer type before the gesture is what decides, because the
 *    event itself does not carry one.
 *  · **A real point only.** The keyboard's own menu key reports the origin, and a menu pinned to the
 *    viewport's corner is not anchored to anything; a keyboard gesture falls through to the sheet.
 *  · **Once, and briefly.** A claim consumes the gesture, and one that nothing claimed within
 *    {@link POINTER_MENU_TTL_MS} is stale — a right-click that opened nothing must never place the
 *    next sheet a normal tap opens.
 */

export interface PointerMenuGesture {
  readonly x: number;
  readonly y: number;
  /** When it happened, on the store's own clock. */
  readonly at: number;
}

/** How long an unclaimed gesture stays claimable. One navigation's worth, and no more. */
export const POINTER_MENU_TTL_MS = 1500;

export interface PointerMenuStore {
  /** The pointer type of the press in progress — `pointerdown`'s own `pointerType`. */
  notePointer(type: string): void;
  /** A `contextmenu` at this point. Ignored unless the press before it was a mouse's. */
  note(x: number, y: number): void;
  /** Claim the pending gesture, if there is a live one. Consumes it either way. */
  take(): PointerMenuGesture | null;
}

export function createPointerMenuStore(now: () => number = () => Date.now()): PointerMenuStore {
  let pending: PointerMenuGesture | null = null;
  let pointer = "mouse";
  return {
    notePointer(type) {
      pointer = type;
    },
    note(x, y) {
      if (pointer !== "mouse") return;
      // The keyboard's menu key reports the origin. A menu is anchored to a cursor or it is not
      // anchored at all, so that gesture is not one of ours.
      if (x <= 0 && y <= 0) return;
      pending = { x, y, at: now() };
    },
    take() {
      const gesture = pending;
      pending = null;
      if (gesture === null) return null;
      return now() - gesture.at > POINTER_MENU_TTL_MS ? null : gesture;
    },
  };
}

/** The one store the app's listeners write to and its sheets read from. */
export const pointerMenuGestures = createPointerMenuStore();
