import { describe, expect, test } from "bun:test";

import { DOM_DELTA_LINE, TOUCH_SLOP_PX, TouchScroll, cellHeightOf, wheelStep, type TouchPoint } from "./touch-scroll.ts";

const CELL = 20;

function swipe(from: TouchPoint, ys: readonly number[], x = from.x) {
  const gesture = new TouchScroll();
  gesture.begin(from, 1);
  const steps = ys.map((y) => gesture.move({ x, y }, 1, CELL));
  return { gesture, steps };
}

describe("classifying a touch", () => {
  test("a touch that stays inside the slop is a tap and produces nothing", () => {
    const { gesture, steps } = swipe({ x: 100, y: 300 }, [300 - TOUCH_SLOP_PX, 300 + TOUCH_SLOP_PX]);
    expect(steps).toEqual([0, 0]);
    expect(gesture.swiping).toBe(false);
  });

  test("a mostly vertical travel past the slop is a swipe", () => {
    const { gesture } = swipe({ x: 100, y: 300 }, [300 - TOUCH_SLOP_PX - 1], 103);
    expect(gesture.swiping).toBe(true);
  });

  test("a mostly sideways travel is the browser's for the rest of the touch", () => {
    const { gesture, steps } = swipe({ x: 100, y: 300 }, [295, 200, 100], 140);
    expect(gesture.swiping).toBe(false);
    expect(steps).toEqual([0, 0, 0]);
  });

  test("two fingers are never a swipe, from the start or joining midway", () => {
    const pinch = new TouchScroll();
    pinch.begin({ x: 0, y: 300 }, 2);
    expect(pinch.move({ x: 0, y: 100 }, 2, CELL)).toBe(0);
    expect(pinch.swiping).toBe(false);

    const { gesture } = swipe({ x: 0, y: 300 }, [250]);
    expect(gesture.swiping).toBe(true);
    expect(gesture.move({ x: 0, y: 100 }, 2, CELL)).toBe(0);
    expect(gesture.swiping).toBe(false);
    expect(gesture.move({ x: 0, y: 0 }, 1, CELL)).toBe(0);
  });
});

describe("counting steps", () => {
  test("finger up is wheel down, one step per cell, slop travel included", () => {
    const { steps } = swipe({ x: 0, y: 300 }, [300 - 3 * CELL]);
    expect(steps).toEqual([3]);
  });

  test("finger down is wheel up", () => {
    const { steps } = swipe({ x: 0, y: 300 }, [300 + 2 * CELL]);
    expect(steps).toEqual([-2]);
  });

  test("travel short of a cell is kept for the next movement of the same swipe", () => {
    const { steps } = swipe({ x: 0, y: 300 }, [285, 275, 265, 255]);
    // 15 (pending → swipe, 0), 25 → 1, 35 → 0 more, 45 → 1 more.
    expect(steps).toEqual([0, 1, 0, 1]);
  });

  test("slow and fast swipes over the same distance give the same total", () => {
    const slow = swipe({ x: 0, y: 300 }, Array.from({ length: 100 }, (_, index) => 300 - (index + 1)));
    const fast = swipe({ x: 0, y: 300 }, [200]);
    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
    expect(sum(slow.steps)).toBe(5);
    expect(sum(fast.steps)).toBe(5);
  });

  test("a reversal spends the remainder first", () => {
    const { steps } = swipe({ x: 0, y: 300 }, [270, 300]);
    // Up 30: one step down, 10 left; then down 30: −20 → one step up.
    expect(steps).toEqual([1, -1]);
  });

  test("a new touch starts from nothing, and the swipe's origin is where it began", () => {
    const { gesture } = swipe({ x: 40, y: 300 }, [285]);
    gesture.end();
    expect(gesture.swiping).toBe(false);
    gesture.begin({ x: 7, y: 100 }, 1);
    expect(gesture.move({ x: 7, y: 95 }, 1, CELL)).toBe(0);
    expect(gesture.move({ x: 7, y: 81 }, 1, CELL)).toBe(0);
    expect(gesture.move({ x: 7, y: 80 }, 1, CELL)).toBe(1);
    expect(gesture.origin).toEqual({ x: 7, y: 100 });
  });

  test("an unmeasured cell produces nothing rather than a flood", () => {
    const gesture = new TouchScroll();
    gesture.begin({ x: 0, y: 300 }, 1);
    expect(gesture.move({ x: 0, y: 100 }, 1, 0)).toBe(0);
    expect(gesture.move({ x: 0, y: 50 }, 1, Number.NaN)).toBe(0);
  });
});

describe("the cell and the step", () => {
  test("the cell is the rendered screen over its rows, spacing included", () => {
    expect(cellHeightOf(600, 30, 10, 1.5)).toBe(20);
  });

  test("before a render, the face's size times its line height stands in", () => {
    expect(cellHeightOf(0, 30, 10, 1.5)).toBe(15);
    expect(cellHeightOf(600, 0, 12, 1)).toBe(12);
  });

  test("one step is a single line at the swipe's origin, which the emulator neither damps nor drops", () => {
    expect(wheelStep(3, { x: 5, y: 9 })).toEqual({ deltaY: 1, deltaMode: DOM_DELTA_LINE, clientX: 5, clientY: 9, bubbles: true, cancelable: true });
    expect(wheelStep(-1, { x: 5, y: 9 }).deltaY).toBe(-1);
  });
});
