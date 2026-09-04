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
  /** The accessible name — what these verbs act on. Drawn as a caption too, quietly. */
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
        "fixed z-50 w-56 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-md border border-rule bg-card p-1 shadow-lg",
        "max-h-[min(70dvh,26rem)]",
        // FADE ONLY. See the header: the box is already at the cursor, so there is nowhere to
        // travel from.
        "duration-150 animate-in fade-in",
      )}
    >
      {/* The target, quietly — a menu that acts on one row should say which row, and this is the
          only place left to say it once the sheet's title bar is gone. Not a heading a reader has to
          step through: the menu's own `aria-label` already carries the name. */}
      <div
        aria-hidden
        className="truncate px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </div>
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
 * density: 28px rather than the 44px a thumb is owed, because this surface only exists on a machine
 * that has a cursor.
 */
export function FleetMenuItem({ icon, label, onSelect, disabled, busy }: FleetMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled === true || busy === true}
      onClick={onSelect}
      className="flex min-h-7 w-full items-center gap-2.5 rounded-sm px-2 py-1 text-left text-[13px] transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
    >
      {busy === true ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

export interface FleetMenuDestructiveItemProps {
  icon: ReactNode;
  label: string;
  /** What the row says once it is armed — the blast radius, in the caller's words. */
  confirmLabel: string;
  busyLabel: string;
  armed: boolean;
  busy: boolean;
  onSelect: () => void;
}

/**
 * The two-tap verb, and the two taps are not negotiable here either: this is the same act Collie's
 * sheet performs with the same confirmation, so a pointer does not get a shortcut to it that a thumb
 * does not have. Armed, the row says the blast radius rather than repeating the verb.
 */
export function FleetMenuDestructiveItem({
  icon,
  label,
  confirmLabel,
  busyLabel,
  armed,
  busy,
  onSelect,
}: FleetMenuDestructiveItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={busy}
      onClick={onSelect}
      className={cn(
        "flex min-h-7 w-full items-center gap-2.5 rounded-sm px-2 py-1 text-left text-[13px] transition-colors focus-visible:outline-none disabled:pointer-events-none",
        armed
          ? "bg-status-blocked/10 font-medium text-status-blocked"
          : "text-status-blocked hover:bg-status-blocked/10 focus-visible:bg-status-blocked/10",
      )}
    >
      {busy ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : icon}
      <span className="truncate">{busy ? busyLabel : armed ? confirmLabel : label}</span>
    </button>
  );
}
