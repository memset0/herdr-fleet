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

/** Where to put the box, in the same viewport coordinates. */
export interface MenuOffset {
  readonly left: number;
  readonly top: number;
}

/** The gap kept between the menu and the edge it is nearest. */
export const MENU_MARGIN = 8;

function axis(at: number, size: number, bound: number, margin: number): number {
  // Room for the whole box on the far side of the point is the ordinary case.
  if (at + size + margin <= bound) return at;
  // Otherwise flip: the box ends AT the point, so the cursor still sits on its corner.
  const flipped = at - size;
  if (flipped >= margin) return flipped;
  // Neither side fits, so the box is bigger than the space. Pin it and let it scroll — a menu the
  // pointer cannot reach is worse than one that is not where the pointer left off.
  return Math.max(margin, Math.min(at, bound - size - margin));
}

export function placeMenu(
  at: MenuPoint,
  box: MenuBox,
  bounds: MenuBox,
  margin: number = MENU_MARGIN,
): MenuOffset {
  return {
    left: axis(at.x, box.width, bounds.width, margin),
    top: axis(at.y, box.height, bounds.height, margin),
  };
}
