import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { pointerMenuGestures } from "../../../fleet/ui/pointer-menu.ts";
import type { SheetPlace, SheetPoint } from "@/components/ui/sheet";

/**
 * THE RIGHT-CLICK, CARRIED FROM THE GESTURE TO THE SURFACE IT OPENS.
 *
 * Collie already routes both gestures that ask a row for its actions — a phone's long press and a
 * pointer's right-click — through one hook (`hooks/use-long-press.ts`) into one pair of sheets. What
 * a right-click additionally has is a POINT, and the hook's callback takes no arguments: three call
 * sites (the hierarchy, the tab strip, the pane strip) would each have to grow one to pass it, and
 * two of those are Collie's.
 *
 * So the gesture is recorded once, by the listeners below, and claimed by whichever sheet opens
 * next — the reasoning and the three bounds that keep a timing-based claim honest are stated at
 * `fleet/ui/pointer-menu.ts`. The result is that ALL THREE surfaces get the menu from one port,
 * with the sheets' own rows, capability gating, host block, confirm flow and writes untouched:
 * a right-click and a long press open the same object, and only where it stands differs.
 */

/** The centre, as a value — a question is not asked in a popover pinned to a corner. */
const CENTRE: SheetPlace = { kind: "center" };

/**
 * A machine driven by a POINTER, which is the honest spelling of "a computer, not a phone".
 *
 * The gesture's own pointer type already says a mouse made it, and that is nearly the same answer —
 * but only nearly: a phone browser can raise a context menu whose recorded press was typed anything
 * at all, and a menu 288px wide pinned to a coordinate is the wrong surface for a thumb no matter
 * what raised it. So the DEVICE decides which of the two surfaces exists at all, and the gesture
 * only decides where the one it chose stands. Live, because a tablet gains and loses a mouse.
 */
function useFinePointer(): boolean {
  const [fine, setFine] = useState(
    () => window.matchMedia?.("(pointer: fine) and (hover: hover)").matches ?? false,
  );
  useEffect(() => {
    const query = window.matchMedia?.("(pointer: fine) and (hover: hover)");
    if (!query) return;
    const sync = () => setFine(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return fine;
}

/**
 * Where an actions sheet should stand, given how it was opened and what it is currently showing.
 *
 * `asking` is the caller's own answer to one question: has my content stopped being a list of verbs
 * and become a prompt? Only the sheet knows that — the primitive sees children — and it is the whole
 * reason this returns a placement rather than a point.
 *
 * Claimed in a LAYOUT effect, so the frame where the sheet would have stood at the bottom is never
 * painted.
 */
export function useRowActionsPlace(open: boolean, asking: boolean): SheetPlace | undefined {
  const fine = useFinePointer();
  const [point, setPoint] = useState<SheetPoint | null>(null);
  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    if (open && !wasOpen.current) {
      // Claimed either way, so a gesture a phone made cannot sit in the store and place something
      // later; only what is done with it differs.
      const gesture = pointerMenuGestures.take();
      setPoint(gesture === null || !fine ? null : { kind: "point", x: gesture.x, y: gesture.y });
    } else if (!open) {
      setPoint(null);
    }
    wasOpen.current = open;
  }, [open, fine]);
  if (point === null) return undefined;
  return asking ? CENTRE : point;
}

/**
 * Record every context-menu gesture in the document, once, for the app's lifetime.
 *
 * CAPTURE PHASE, because `useLongPress` calls `preventDefault()` on the same event and opens the
 * sheet from its own handler: the record has to be written before the surface that claims it exists.
 * The pointer type comes from the press, not from this event, which carries none.
 */
export function usePointerMenuGestures(): void {
  useLayoutEffect(() => {
    const onPointerDown = (event: PointerEvent) => pointerMenuGestures.notePointer(event.pointerType);
    const onContextMenu = (event: MouseEvent) => pointerMenuGestures.note(event.clientX, event.clientY);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
    };
  }, []);
}
