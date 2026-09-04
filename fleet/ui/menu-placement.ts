/**
 * WHERE A MENU OPENED BY A POINTER GOES.
 *
 * A context menu is anchored to a POINT rather than to an element, which is the one placement rule
 * the app did not already have: every other floating surface in Collie is docked (the bottom sheet,
 * the toast viewport) or anchored to a control it belongs to. The rule is the platform's, and it is
 * worth stating rather than approximating, because the failure mode is a menu whose rows are off the
 * screen and cannot be reached at all:
 *
 *  1. **Down and to the right of the cursor**, which is where a pointer expects the first row.
 *  2. **Flip, do not slide, when the box would run past an edge.** Sliding a menu back inside puts
 *     its rows UNDER the cursor, so the release of the very click that opened it can land on a row.
 *     Flipping to the other side of the point keeps the cursor on the menu's corner either way.
 *  3. **Clamp only as a last resort**, when the box is larger than the space on both sides — a menu
 *     taller than the viewport has nowhere to flip to, and being reachable beats being anchored.
 *
 * Pure arithmetic, and deliberately: it is the half of a context menu that is worth a test, and
 * testing it through a rendered popover would be testing jsdom's layout instead.
 */

/** The cursor. Viewport coordinates, the same ones a pointer event reports. */
export interface MenuPoint {
  readonly x: number;
  readonly y: number;
}

/** A measured box — the menu's, or the space it has to live in. */
export interface MenuBox {
  readonly width: number;
  readonly height: number;
}

/**
 * Which corner of the box the cursor ended up on. It is a CSS `transform-origin`, and it is part of
 * the placement rather than a detail of the drawing, because it is the same decision: the corner the
 * box was anchored by is the corner it must appear to come out of.
 *
 * A menu that scales up from its own CENTRE looks like it is being squeezed in from every side at
 * once, which is what a centre origin does to a box pinned by one corner — the three edges away from
 * the cursor all travel, and the one at the cursor travels too. Growing from the anchored corner is
 * the whole of the fix, and it cannot be decided anywhere but here: only the flip knows which corner
 * that is.
 */
export type MenuOrigin = "left top" | "right top" | "left bottom" | "right bottom";

/** Where to put the box, in the same viewport coordinates, and which corner it grew from. */
export interface MenuOffset {
  readonly left: number;
  readonly top: number;
  readonly origin: MenuOrigin;
}

/** The gap kept between the menu and the edge it is nearest. */
export const MENU_MARGIN = 8;

interface Placed {
  readonly value: number;
  /** True when the box ends at the point rather than starting from it. */
  readonly flipped: boolean;
}

function axis(at: number, size: number, bound: number, margin: number): Placed {
  // Room for the whole box on the far side of the point is the ordinary case.
  if (at + size + margin <= bound) return { value: at, flipped: false };
  // Otherwise flip: the box ends AT the point, so the cursor still sits on its corner.
  const flipped = at - size;
  if (flipped >= margin) return { value: flipped, flipped: true };
  // Neither side fits, so the box is bigger than the space. Pin it and let it scroll — a menu the
  // pointer cannot reach is worse than one that is not where the pointer left off. Nothing is
  // anchored any more, so the origin stays the unflipped one rather than claiming a corner the
  // cursor is not on.
  return { value: Math.max(margin, Math.min(at, bound - size - margin)), flipped: false };
}

export function placeMenu(
  at: MenuPoint,
  box: MenuBox,
  bounds: MenuBox,
  margin: number = MENU_MARGIN,
): MenuOffset {
  const x = axis(at.x, box.width, bounds.width, margin);
  const y = axis(at.y, box.height, bounds.height, margin);
  return {
    left: x.value,
    top: y.value,
    // SAFETY: both halves come from the two-value unions below, so every combination is one of the
    // four `MenuOrigin` strings; the type is stated because template literals widen to `string`.
    origin: `${x.flipped ? "right" : "left"} ${y.flipped ? "bottom" : "top"}` as MenuOrigin,
  };
}
