/**
 * A one-finger vertical swipe over the terminal, read as mouse-wheel steps.
 *
 * The emulator is built without scrollback and binds no touch handlers of its own, so on a phone a
 * swipe reaches nothing. This module decides what a touch means — a swipe, or something that is the
 * browser's (a tap, a long press, a sideways swipe, a pinch) — and how many wheel steps the travel so
 * far is worth. The surface turns each step into one wheel event on the emulator's own element, so
 * the protocol, the encoding and the no-mouse-tracking cursor-key fallback stay the emulator's.
 *
 * Direction is a phone's: a finger moving UP pulls the content up, which is a wheel DOWN, so a step
 * is positive (`deltaY > 0`) when the finger has moved up.
 */

/** Travel, in CSS pixels, before a touch is classified at all: under it, a touch is still a tap. */
export const TOUCH_SLOP_PX = 8;

/** `WheelEvent.DOM_DELTA_LINE`, spelled here so this module needs no DOM. */
export const DOM_DELTA_LINE = 1;

export interface TouchPoint {
  readonly x: number;
  readonly y: number;
}

type Phase = "idle" | "pending" | "swipe" | "ignored";

export class TouchScroll {
  private phase: Phase = "idle";
  private start: TouchPoint = { x: 0, y: 0 };
  private lastY = 0;
  /** Finger travel not yet spent on a step, in pixels; positive is upward. */
  private remainder = 0;

  /** Where the swipe began, which is the cell its reports name. */
  get origin(): TouchPoint {
    return this.start;
  }

  /** True while the current touch is a swipe: the page must not scroll under it. */
  get swiping(): boolean {
    return this.phase === "swipe";
  }

  /** A touch began. More than one finger is never a swipe — a pinch stays the browser's. */
  begin(point: TouchPoint, fingers: number): void {
    this.start = point;
    this.lastY = point.y;
    this.remainder = 0;
    this.phase = fingers === 1 ? "pending" : "ignored";
  }

  /**
   * The finger moved. Returns the signed number of wheel steps this movement completes: positive is
   * wheel down (finger up), negative wheel up, zero for none — including every touch that is not a
   * swipe. Travel short of a cell is kept for the next movement of the same swipe.
   */
  move(point: TouchPoint, fingers: number, cellHeight: number): number {
    if (fingers !== 1) {
      this.phase = "ignored";
      return 0;
    }
    if (this.phase === "pending") {
      const dx = Math.abs(point.x - this.start.x);
      const dy = Math.abs(point.y - this.start.y);
      if (Math.max(dx, dy) <= TOUCH_SLOP_PX) return 0;
      this.phase = dy > dx ? "swipe" : "ignored";
    }
    if (this.phase !== "swipe" || !(cellHeight > 0)) return 0;
    // The slop's own travel counts, so the first step lands one cell from where the finger began.
    this.remainder += this.lastY - point.y;
    this.lastY = point.y;
    const steps = Math.trunc(this.remainder / cellHeight);
    this.remainder -= steps * cellHeight;
    return steps;
  }

  /** The touch ended or was cancelled. */
  end(): void {
    this.phase = "idle";
    this.remainder = 0;
  }
}

/**
 * The height of one terminal row in CSS pixels: the rendered screen divided by its rows, which
 * includes the operator's line spacing. Before the first render there is no screen to read, so the
 * face's own size times its line height stands in.
 */
export function cellHeightOf(screenHeight: number, rows: number, fontSize: number, lineHeight: number): number {
  if (screenHeight > 0 && rows > 0) return screenHeight / rows;
  return fontSize * lineHeight;
}

/** What one wheel step is: a single line, so the emulator neither damps it nor accumulates it away. */
export function wheelStep(direction: number, origin: TouchPoint): WheelEventInit {
  return {
    deltaY: direction > 0 ? 1 : -1,
    deltaMode: DOM_DELTA_LINE,
    clientX: origin.x,
    clientY: origin.y,
    bubbles: true,
    cancelable: true,
  };
}
