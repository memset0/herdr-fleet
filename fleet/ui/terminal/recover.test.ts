import { describe, expect, test } from "bun:test";

import { EARLY_EXIT_WINDOW_MS } from "../../terminal/early-exit.ts";
import { EARLY_RETRY_BUDGET_MS, EARLY_RETRY_STABLE_MS, EarlyExitRetry } from "./recover.ts";

/** Drive a run whose every attempt fails the moment it starts; the delays it chose, in order. */
function failEveryAttempt(retry: EarlyExitRetry, start = 0): number[] {
  const delays: number[] = [];
  let now = start;
  for (;;) {
    const delay = retry.next(now);
    if (delay === null) return delays;
    delays.push(delay);
    now += delay;
  }
}

describe("retrying a terminal that exits as it starts", () => {
  test("backs off 1, 2, 4, 8, 15 seconds, then every 30, inside three minutes", () => {
    const delays = failEveryAttempt(new EarlyExitRetry(), 50_000);
    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 15_000, 30_000, 30_000, 30_000, 30_000, 30_000]);
    expect(delays.reduce((sum, delay) => sum + delay, 0)).toBeLessThanOrEqual(EARLY_RETRY_BUDGET_MS);
  });

  test("a spent run stays spent until it is reset", () => {
    const retry = new EarlyExitRetry();
    failEveryAttempt(retry);
    expect(retry.next(EARLY_RETRY_BUDGET_MS + 1)).toBeNull();
    expect(retry.active()).toBe(true);
    retry.reset();
    expect(retry.active()).toBe(false);
    expect(retry.next(1_000_000)).toBe(1_000);
  });

  test("a reset in the middle starts the schedule again from one second", () => {
    const retry = new EarlyExitRetry();
    expect(retry.next(0)).toBe(1_000);
    expect(retry.next(1_000)).toBe(2_000);
    expect(retry.scheduled()).toBe(2);
    retry.reset();
    expect(retry.next(3_000)).toBe(1_000);
  });

  test("the budget is measured from the run's first failure, not from each attempt", () => {
    const retry = new EarlyExitRetry();
    expect(retry.next(0)).toBe(1_000);
    // A slow failing attempt late in the budget still stops the run.
    expect(retry.next(EARLY_RETRY_BUDGET_MS - 1_000)).toBeNull();
  });

  test("a connection is judged to have held only after the early window has passed", () => {
    expect(EARLY_RETRY_STABLE_MS).toBeGreaterThan(EARLY_EXIT_WINDOW_MS);
  });
});
