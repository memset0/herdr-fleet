// How long the callers of a Send Protocol send wait for its answer (fleet-send-patience).
//
// The bridge's own steps are bounded in bridge/surface/protocol.ts (`BOUNDS`, and `LOCK_BOUND_MS`,
// their sum). Two callers wait on a send from outside the bridge: the lead, forwarding a crew
// member's reply route, and the phone, posting the send. Each must outlast what it waits on, or it
// gives up on a send the bridge is still running and the person reads "no answer" over a text that
// went in. The numbers stand alone because the web bundle must not import the bridge's protocol
// module; fleet/send-patience.test.ts holds them in that order against `LOCK_BOUND_MS`.

/** The lead's budget for forwarding a member pane's reply route, which runs a whole send on the member. */
export const SEND_FORWARD_BUDGET_MS = 50_000;

/** The phone's budget for one send request, through `/api/send` or a member pane's reply route. */
export const SEND_REQUEST_TIMEOUT_MS = 60_000;

/** A pane's reply route as the lead's forward names it (`bridge/crew/forward.ts`, without `/api/`). */
const REPLY_ROUTE = /^pane\/[^/]+\/reply$/u;

/**
 * The budget a forwarded write dials on: a pane's reply route takes the send budget, every other
 * write keeps the one it is given.
 */
export function forwardWriteBudget(route: string, writeBudgetMs: number): number {
  return REPLY_ROUTE.test(route) ? Math.max(SEND_FORWARD_BUDGET_MS, writeBudgetMs) : writeBudgetMs;
}

/**
 * How long the phone waits for a pane to repaint after it sent a key to a card (`settleAfterSend`,
 * web/src/lib/harness/guard.ts). Collie's 1.2 s gives up before a slow pane repaints, and the next
 * tap then meets a stale card; the wait still ends on the first changed read.
 */
export const TAP_SETTLE_DEADLINE_MS = 5_000;
