import * as React from "react";
import { X } from "lucide-react";

import { placeMenu, type MenuOffset } from "../../../../fleet/ui/menu-placement.ts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { t as translate } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

// Minimal modal focus handling (no deps, no full trap): on open move focus into the panel so
// keyboard / screen-reader users land inside the dialog; on close restore focus to whatever was
// focused before it opened. The panel must carry tabIndex={-1} to be a focus target.
function useDialogFocus(open: boolean, panelRef: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    if (!open) return;
    // SAFETY: `document.activeElement` is typed `Element | null`; the only thing read off it below
    // is the optional `focus()`, which is what makes it an HTMLElement in practice. The optional
    // call is what covers the case where it isn't one (an SVG element, say).
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [open, panelRef]);
}

// A minimal bottom sheet — no Radix, no portals, no extra deps. Renders nothing when closed.
// Dismisses on backdrop tap or Escape. Animations come from tw-animate-css (already imported).
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /**
   * A string everywhere except PaneActionsSheet, which composes the pane name with a `HostChip`
   * (the "which machine" disambiguator) on the same row — so this is `ReactNode`, not `string`.
   * Every other caller already passes a plain translated string, which is a `ReactNode` too, so
   * widening this cost them nothing. The `title ? … : undefined` id-linking below still works
   * because a non-empty node is truthy and the only falsy `ReactNode`s a caller passes here are
   * `undefined` and `""`, both "no title".
   */
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** DOWNSTREAM PORT — where this sheet stands. Absent is the bottom sheet, unchanged.
   *
   *  A sheet reached by a right-click is a CONTEXT MENU, and a context menu that slides up from the
   *  bottom of a desktop screen has left the pointer behind: the rows are 900px from the row they
   *  are about. Same content, same writes, same rules — only the presentation follows the gesture
   *  that asked for it, which is why this is a placement and not a second component.
   *
   *  `center` is the other half of the same idea: a menu that turns into a QUESTION (a rename's
   *  field) must not answer it in a 288px popover pinned to a corner. The caller says when its own
   *  content has become a prompt; the primitive only knows how to stand. */
  place?: SheetPlace;
}

/** Anchored to a cursor — viewport coordinates, the ones a pointer event reports. */
export interface SheetPoint {
  readonly kind: "point";
  readonly x: number;
  readonly y: number;
}

/** Standing in the middle of the screen, which is where a question goes. */
export interface SheetCentre {
  readonly kind: "center";
}

export type SheetPlace = SheetPoint | SheetCentre;

export function BottomSheet({ open, onClose, title, children, className, place }: BottomSheetProps) {
  useLocale();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef({ startY: 0, atTop: false, engaged: false, dy: 0 });
  const [dragY, setDragY] = React.useState(0);
  const titleId = React.useId();
  useDialogFocus(open, panelRef);

  // Backdrop dismiss requires press AND release on the backdrop itself (the Radix
  // outside-pointerdown rule) — NOT just whatever the browser happens to synthesize a `click` on. A
  // long-press that opens this sheet has its finger still down at the moment the sheet mounts; the
  // browser's release click then lands on whatever is now under the finger, which is the backdrop —
  // and without this guard that click would immediately close the sheet it just opened. Arming only
  // on a backdrop `pointerdown` means a click that originated elsewhere (e.g. the pill's release)
  // never dismisses.
  const backdropArmed = React.useRef(false);
  React.useEffect(() => {
    if (open) backdropArmed.current = false;
  }, [open]);

  // THE MENU'S OWN POSITION, measured rather than guessed: the box's size is its rows', and its rows
  // are the caller's, so nothing here can know the height before it is drawn. One layout pass — read
  // the box, ask the fork's geometry where it goes, write the offset — which is why the panel is
  // hidden until the answer arrives: `left: 0, top: 0` for one frame is a menu that visibly jumps.
  const anchored = place?.kind === "point" ? place : null;
  const [offset, setOffset] = React.useState<MenuOffset | null>(null);
  React.useLayoutEffect(() => {
    if (!open || anchored === null) {
      setOffset(null);
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    const box = panel.getBoundingClientRect();
    setOffset(
      placeMenu(
        { x: anchored.x, y: anchored.y },
        { width: box.width, height: box.height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, [open, anchored]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Drag-to-dismiss: pull the sheet down from the top to close it. The touchmove listener is
  // attached NON-PASSIVE so we can `preventDefault()` the downward pull — that's what suppresses
  // the browser's pull-to-refresh (otherwise a pull-down at the top would reload the whole app
  // instead of closing the sheet). A gesture that starts mid-scroll falls through to normal list
  // scrolling; only a pull that begins at the top engages the dismiss.
  React.useEffect(() => {
    const panel = panelRef.current;
    // A placed sheet is not dragged away: a menu has no grab handle and a dialog is not pulled down.
    if (!open || !panel || place !== undefined) return;
    setDragY(0);
    const SLOP = 6; // ignore taps / tiny jitter before engaging the drag
    const CLOSE = 90; // px past which release closes instead of snapping back

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      drag.current = { startY: t.clientY, atTop: panel.scrollTop <= 0, engaged: false, dy: 0 };
    };
    const onMove = (e: TouchEvent) => {
      const d = drag.current;
      if (!d.atTop) return;
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - d.startY;
      if (!d.engaged && dy > SLOP) d.engaged = true;
      if (d.engaged) {
        e.preventDefault();
        const off = Math.max(0, dy);
        d.dy = off;
        setDragY(off);
      }
    };
    const onEnd = () => {
      const off = drag.current.dy;
      drag.current = { startY: 0, atTop: false, engaged: false, dy: 0 };
      if (off > CLOSE) onClose();
      else setDragY(0);
    };

    panel.addEventListener("touchstart", onStart, { passive: true });
    panel.addEventListener("touchmove", onMove, { passive: false });
    panel.addEventListener("touchend", onEnd);
    panel.addEventListener("touchcancel", onEnd);
    return () => {
      panel.removeEventListener("touchstart", onStart);
      panel.removeEventListener("touchmove", onMove);
      panel.removeEventListener("touchend", onEnd);
      panel.removeEventListener("touchcancel", onEnd);
    };
  }, [open, onClose, place]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50",
        // Three stands, one panel. The bottom sheet is unchanged and is what every caller that says
        // nothing still gets; a centred dialog holds a question; an anchored menu places itself, so
        // this layer only has to stay out of its way.
        anchored !== null
          ? ""
          : place?.kind === "center"
            ? "flex items-center justify-center p-4"
            : "flex flex-col justify-end",
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      {/* Backdrop: still dismisses on tap, but hidden from assistive tech — the ✕ in the header is
          the single accessible "Close", so the dialog isn't announced with a giant duplicate. Dismiss
          fires only when the pointer went DOWN on the backdrop too — see backdropArmed above. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className={cn(
          "absolute inset-0 duration-200 animate-in fade-in",
          // A MENU DOES NOT DIM THE APP. The scrim belongs to the bottom sheet and the dialog, where
          // the panel has taken the screen over and the page behind it is out of play. A context
          // menu is a small, cheap, look-away-to-cancel thing standing ON the row it is about, and
          // dimming that row dims the very thing the reader opened it to check against. It still
          // catches the click that dismisses it, which is the scrim's other job and the only one a
          // menu needs.
          anchored === null && "bg-black/50",
        )}
        onPointerDown={() => {
          backdropArmed.current = true;
        }}
        onClick={() => {
          if (!backdropArmed.current) return;
          backdropArmed.current = false;
          onClose();
        }}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        style={
          anchored !== null
            ? {
                left: offset?.left ?? 0,
                top: offset?.top ?? 0,
                // Hidden, not unmounted: the box has to be in the layout to be measured, and one
                // frame at the origin is a menu that visibly jumps into place.
                visibility: offset === null ? "hidden" : "visible",
              }
            : {
                transform: dragY ? `translateY(${dragY}px)` : undefined,
                transition: drag.current.engaged ? "none" : "transform 0.2s ease-out",
              }
        }
        className={cn(
          // `rounded-t-md` (2px), not `rounded-t-2xl`: 16px was the roundest corner left in the app and it
          // sat on the most-seen surface. The sheet is a panel, and a panel has an edge.
          //
          // THE GROUND IS `--card`, NOT `--background`, and the edge is `--rule`. A sheet is a raised
          // surface over the page, which is the one thing --card is for — and on --background it was
          // the SAME value as the page it floats over. In dark that is the app's worst case: the page
          // is oklch(0.145), the scrim behind the panel only darkens it further, and the panel's only
          // separation was a --border hairline at 1.26:1. The operator's report was that the drawer
          // was hard to make out at all. --card is oklch(0.205), a real step up, so the panel reads
          // as raised rather than as a hole; --rule (2.06:1 dark) then draws the edge, because this
          // is a cut between two REGIONS and not a component's own outline (DESIGN.md §4). Light
          // gains the same separation for free: white on rgb(245) instead of rgb(245) on rgb(245).
          "z-10 overflow-y-auto overscroll-contain bg-card shadow-2xl duration-200 animate-in",
          // The three stands differ in exactly four things: where the box sits, how wide it is, which
          // of its edges are cut, and which direction it arrives from. Everything else — the ground,
          // the rule, the shadow, the scroll — is the panel's and is shared, because this is one
          // surface presented three ways rather than three surfaces.
          anchored !== null
            ? "absolute max-h-[70dvh] w-72 max-w-[calc(100vw-1rem)] rounded-md border border-rule fade-in zoom-in-95"
            : place?.kind === "center"
              ? "relative max-h-[82dvh] w-full max-w-sm rounded-md border border-rule pb-4 fade-in zoom-in-95"
              : "relative max-h-[82dvh] w-full rounded-t-md border-t border-rule slide-in-from-bottom pb-[calc(env(safe-area-inset-bottom)_+_1rem)]",
          className,
        )}
      >
        <div className="sticky top-0 z-10 border-b border-rule bg-card/95 backdrop-blur-md">
          {/* Grab handle — pull down (from anywhere at the top) to dismiss. Drawn only where the pull
              exists: a placed sheet does not drag away, and an affordance for a gesture that is not
              armed is a promise the surface does not keep. */}
          {place === undefined && (
            <div className="flex justify-center pt-2 pb-1">
              {/* 4px tall, 36px wide — a stadium, so it takes the house 2px rather than full-round. */}
              <span className="h-1 w-9 rounded-md bg-muted-foreground/40" />
            </div>
          )}
          <div
            data-slot="sheet-title-row"
            className={cn(
              "flex items-center justify-between px-4 pb-3",
              // The handle carried the top padding for the bottom sheet. Without it the row needs
              // its own, or the title sits flush against the panel's cut edge.
              place !== undefined && "pt-3",
            )}
          >
            <span
              id={title ? titleId : undefined}
              data-slot="sheet-title"
              // `flex min-w-0 flex-1 items-center gap-1.5`: harmless for the plain-string title
              // every caller but PaneActionsSheet passes (a lone text child in a flex box still
              // renders as one line) and is what lets THAT caller's composed node — the pane name
              // plus a `HostChip` — share the row and shrink into it instead of overflowing past
              // the close button.
              className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold"
            >
              {title}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={onClose}
              aria-label={translate("common.closeAria")}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <div className="px-4 py-3">{children}</div>
      </div>
    </div>
  );
}

// A left-edge drawer — same no-deps approach as BottomSheet, but slides in from the side and fills
// the viewport height with a scrollable body. Used for the thread sidebar (TUI-style switcher).
interface SideSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Optional action(s) rendered in the header, to the left of the close (✕) button. */
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function SideSheet({
  open,
  onClose,
  title,
  headerAction,
  children,
  footer,
  className,
}: SideSheetProps) {
  useLocale();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  useDialogFocus(open, panelRef);

  // Backdrop dismiss requires press AND release on the backdrop itself (the Radix
  // outside-pointerdown rule) — NOT just whatever the browser happens to synthesize a `click` on. A
  // long-press that opens this sheet has its finger still down at the moment the sheet mounts; the
  // browser's release click then lands on whatever is now under the finger, which is the backdrop —
  // and without this guard that click would immediately close the sheet it just opened. Arming only
  // on a backdrop `pointerdown` means a click that originated elsewhere (e.g. the pill's release)
  // never dismisses.
  const backdropArmed = React.useRef(false);
  React.useEffect(() => {
    if (open) backdropArmed.current = false;
  }, [open]);


  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          // Same ground and same edge as the bottom sheet above, for the same reason — one panel
          // surface app-wide, raised off the page rather than painted in the page's own colour.
          "relative z-10 flex h-full w-[86%] max-w-sm flex-col border-r border-rule bg-card shadow-2xl duration-200 animate-in slide-in-from-left",
          className,
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-rule bg-card/95 px-4 py-3 backdrop-blur-md [padding-top:calc(env(safe-area-inset-top)_+_0.75rem)]">
          <span id={title ? titleId : undefined} className="text-sm font-semibold">
            {title}
          </span>
          <div className="flex items-center gap-1">
            {headerAction}
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onClose}
              aria-label={translate("common.closeAria")}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-rule px-3 py-2 pb-[calc(env(safe-area-inset-bottom)_+_0.5rem)]">
            {footer}
          </div>
        )}
      </div>
      {/* Backdrop: dismisses on tap but hidden from assistive tech — the header ✕ is the accessible
          "Close", so the drawer isn't announced with a giant duplicate close target. Dismiss fires
          only when the pointer went DOWN on the backdrop too — see backdropArmed above. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className="flex-1 bg-black/50 duration-200 animate-in fade-in"
        onPointerDown={() => {
          backdropArmed.current = true;
        }}
        onClick={() => {
          if (!backdropArmed.current) return;
          backdropArmed.current = false;
          onClose();
        }}
      />
    </div>
  );
}
