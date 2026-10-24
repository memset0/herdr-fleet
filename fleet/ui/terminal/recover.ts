/**
 * How the terminal surface retries a terminal that exits as it starts.
 *
 * The Gateway marks an early exit (see `../../terminal/early-exit.ts`); this decides when the surface
 * tries again. It lives in the browser rather than the Gateway because the surface already has the
 * whole act — Reconnect builds a fresh connection through ordinary admission — so a retry is that act
 * on a timer, cancelled by leaving the Pane, and re-admitted each time. The reasoning is in the
 * owning change's design.
 *
 * A run starts at the first early exit and ends when the operator presses Reconnect, when a close is
 * not an early exit, or when a connection has stayed open past the early window. Inside a run the
 * delays grow and then hold, and the run gives up once the next attempt would start more than the
 * budget after the first failure — at which point the operator is told, with the tail, and acts.
 */

import { EARLY_EXIT_WINDOW_MS } from "../../terminal/early-exit.ts";

/** The delays between automatic attempts; the last one repeats. */
export const EARLY_RETRY_DELAYS_MS: readonly number[] = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];

/** No automatic attempt starts later than this after the run's first early exit. */
export const EARLY_RETRY_BUDGET_MS = 180_000;

/**
 * How long a connection must stay open before the run is over: the early window, and a second of
 * slack for the Gateway's clock and this one disagreeing about when it began.
 */
export const EARLY_RETRY_STABLE_MS = EARLY_EXIT_WINDOW_MS + 1_000;

export class EarlyExitRetry {
  private startedAt: number | null = null;
  private attempts = 0;

  /** Whether a run is in progress. */
  active(): boolean {
    return this.startedAt !== null;
  }

  /** How many automatic attempts this run has scheduled so far. */
  scheduled(): number {
    return this.attempts;
  }

  /**
   * An early exit happened at `now`: the delay before the next automatic attempt, or `null` when the
   * run's budget is spent and the operator has to decide.
   */
  next(now: number): number | null {
    if (this.startedAt === null) this.startedAt = now;
    const last = EARLY_RETRY_DELAYS_MS.length - 1;
    const delay = EARLY_RETRY_DELAYS_MS[Math.min(this.attempts, last)] ?? EARLY_RETRY_DELAYS_MS[last] ?? 0;
    if (now - this.startedAt + delay > EARLY_RETRY_BUDGET_MS) return null;
    this.attempts += 1;
    return delay;
  }

  /** End the run: the operator acted, the terminal held, or it ended for another reason. */
  reset(): void {
    this.startedAt = null;
    this.attempts = 0;
  }
}
