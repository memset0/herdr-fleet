import { Loader2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { placeMenu, type MenuOffset, type MenuPoint } from "../../../fleet/ui/menu-placement.ts";
import { pointerMenuGestures } from "../../../fleet/ui/pointer-menu.ts";
import { cn } from "@/lib/utils";

/**
 * A POINTER'S CONTEXT MENU, and its own component rather than the bottom sheet standing somewhere
 * else.
 *
 * The two surfaces answer the same question and are not the same object. A bottom sheet is a screen
 * you have entered: it dims the app, sticks a titled header over what scrolls under it, offers a
 * 44px row per verb for a thumb, and carries a ✕ because it has taken the page over. A context menu
 * is a small box beside the row it is about: it dims nothing, names its target in one quiet line,
 * spends 28px per row for a cursor, and leaves the moment you look away. One component doing both
 * was one component wearing a costume — its entrance in particular, which scaled from a box's own
 * centre while being pinned by one corner, and read as being squeezed in from every side at once.
 *
 * So: TWO components with the same content, and the invoke site picks. This one draws nothing about
 * WHAT the verbs are — see `fleet-row-actions.tsx`, which owns the rows and the writes and is where
 * the choice is made.
 *
 * IT FADES AND DOES NOT MOVE. There is no scale and no slide: the box is already exactly where the
 * cursor is, so any motion at all is motion away from the thing that caused it.
 *
 * PORTALLED TO THE BODY, and that is not a formality — a menu positioned against the viewport must
 * not inherit an ancestor's `overflow: hidden` (the rails and the strips both clip) or an ancestor's
 * transform, which would silently re-anchor a fixed box. The same reasoning `ui/toast-viewport.tsx`
 * spells out for its own bottom dock.
 */

/**
 * Record every context gesture in the document, once, for the app's lifetime.
 *
 * The three surfaces that ask a row for its actions — the fork's hierarchy and Collie's tab and pane
 * strips — all route both gestures through one hook (`hooks/use-long-press.ts`) into one pair of
 * sheets, and that hook's callback takes no arguments. So the POINT is recorded here rather than
 * threaded through three call sites, two of which are upstream's, and claimed by whichever surface
 * opens next; `fleet/ui/pointer-menu.ts` states the three bounds that keep that honest.
 *
 * CAPTURE PHASE, because `useLongPress` calls `preventDefault()` on the same event and opens its
 * surface from its own handler: the record has to exist before the thing that claims it does.
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

export interface FleetContextMenuProps {
  open: boolean;
  /** Where the cursor was. A menu with no point is a menu with nothing to anchor to; it draws none. */
  at: MenuPoint | null;
  onClose: () => void;
  /**
   * What these verbs act on — the menu's ACCESSIBLE NAME, and nothing that is drawn.
   *
   * A sheet has to print it: it covers the app, so the surface underneath is gone and the operator
   * needs telling which row they landed on. A menu is standing ON that row, four pixels from the
   * name it would repeat — a caption there is the answer to a question the screen is already
   * answering, in the one surface with the least room to spend on it. A screen reader has no such
   * view, so it keeps the name.
   */
  label: string;
  children: ReactNode;
}

export function FleetContextMenu({ open, at, onClose, label, children }: FleetContextMenuProps) {
  const menu = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState<MenuOffset | null>(null);

  // MEASURED, NOT GUESSED: the box's height is its rows', and the rows are the caller's. One layout
  // pass before paint — read the box, ask the fork's geometry where it goes, write the offset — with
  // the box hidden until the answer lands, because one frame at the origin is a menu that jumps.
  useLayoutEffect(() => {
    if (!open || at === null) {
      setOffset(null);
      return;
    }
    const box = menu.current?.getBoundingClientRect();
    if (box === undefined) return;
    setOffset(
      placeMenu(
        at,
        { width: box.width, height: box.height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, [open, at]);

  // Focus goes INTO the menu on open and back to whatever had it on close — the same promise the
  // sheet makes, for the same reason: a surface a keyboard cannot reach is a surface a keyboard
  // cannot leave either.
  useEffect(() => {
    if (!open) return;
    // SAFETY: `document.activeElement` is typed `Element | null`; the only thing read off it is the
    // optional `focus()`, and the optional call is what covers an element that has none.
    const previous = document.activeElement as HTMLElement | null;
    menu.current?.focus();
    return () => previous?.focus?.();
  }, [open]);

  // A MENU DIES ON ANY OF THE THREE THINGS THAT INVALIDATE IT: a press somewhere else, Escape, or
  // the page moving under it. The last one is why a menu is not a dialog — it is anchored to a
  // coordinate, and a coordinate stops meaning anything the moment the surface scrolls.
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      const target = event.target;
      // SAFETY: `contains` accepts a `Node | null`, and every other value simply fails the check —
      // an event target that is not a node cannot be inside the menu.
      if (target instanceof Node && menu.current?.contains(target) === true) return;
      onClose();
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [open, onClose]);

  // Arrow keys walk the items, which is the one thing a `role="menu"` promises that a list of
  // buttons does not. Read from the DOM rather than from a registry of children: the items are the
  // caller's, several of them are conditional, and a registry would be a second copy of a list the
  // browser already keeps in order.
  const onMenuKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const items = Array.from(
      menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    if (items.length === 0) return;
    event.preventDefault();
    const here = items.findIndex((item) => item === document.activeElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? (here + 1) % items.length
            : (here <= 0 ? items.length : here) - 1;
    items[next]?.focus();
  }, []);

  if (!open || at === null) return null;

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onMenuKeyDown}
      style={{
        left: offset?.left ?? at.x,
        top: offset?.top ?? at.y,
        // In the layout, so it can be measured; not painted, so the measurement is never seen.
        visibility: offset === null ? "hidden" : "visible",
      }}
      className={cn(
        // `--card` and `--rule`, the ground and the edge every raised surface in this app stands on
        // (ui/sheet.tsx states the measurement). `z-50` puts it over the sheets' own rung, because a
        // menu is always the most recent thing the operator asked for.
        // A CURSOR'S SIZE. 176px and 24px rows are what a desktop context menu is; the 44px row and
        // the 288px box this started at are a thumb's measurements, and they made three verbs look
        // like a panel. Nothing here is a tap target — the surface only exists on a machine that
        // aims with a pointer.
        "fixed z-50 w-44 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-md border border-rule bg-card p-1 shadow-lg",
        "max-h-[min(70dvh,26rem)]",
        // FADE ONLY. See the header: the box is already at the cursor, so there is nowhere to
        // travel from.
        "duration-150 animate-in fade-in",
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

export interface FleetMenuItemProps {
  icon: ReactNode;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  busy?: boolean;
}

/**
 * One verb. The shape is Collie's `ActionRow` — glyph, then label, one line — at a POINTER's
 * density: 24px rather than the 44px a thumb is owed, because this surface only exists on a machine
 * that aims.
 */
export function FleetMenuItem({ icon, label, onSelect, disabled, busy }: FleetMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled === true || busy === true}
      onClick={onSelect}
      className="flex min-h-6 w-full items-center gap-2 rounded-sm px-1.5 py-0.5 text-left text-xs transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
    >
      {busy === true ? <Loader2 className="size-3 shrink-0 animate-spin" /> : icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

export interface FleetMenuDestructiveItemProps {
  icon: ReactNode;
  label: string;
  busyLabel: string;
  busy: boolean;
  onSelect: () => void;
}

/**
 * The destructive verb, and it runs on the FIRST activation.
 *
 * The bottom sheet arms and asks again, and that is right where it lives: a sheet slides up under a
 * thumb that was resting on the row it just long-pressed, its rows are 44px of a surface the finger
 * is already touching, and the tap that opened it and the tap that acts are the same gesture
 * continued. A confirm there is buying protection from a real slip.
 *
 * A context menu is not that. It does not exist until a deliberate secondary click has been made,
 * it appears beside the pointer rather than under it, and reaching a row means moving to it and
 * pressing again — the two deliberate acts the sheet's second tap was standing in for. Asking a
 * third time is asking the operator to confirm that they meant the thing they have already done
 * twice, which is how a confirmation stops being read at all.
 *
 * The refusals that actually protect anything are unchanged and are not confirmations: the
 * capability gate, the read-only refusal and the host write block all still decide whether this row
 * is drawn at all.
 */
export function FleetMenuDestructiveItem({
  icon,
  label,
  busyLabel,
  busy,
  onSelect,
}: FleetMenuDestructiveItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={busy}
      onClick={onSelect}
      className="flex min-h-6 w-full items-center gap-2 rounded-sm px-1.5 py-0.5 text-left text-xs text-status-blocked transition-colors hover:bg-status-blocked/10 focus-visible:bg-status-blocked/10 focus-visible:outline-none disabled:pointer-events-none"
    >
      {busy ? <Loader2 className="size-3 shrink-0 animate-spin" /> : icon}
      <span className="truncate">{busy ? busyLabel : label}</span>
    </button>
  );
}
