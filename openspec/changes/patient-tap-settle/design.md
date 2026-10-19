## Context

`settleAfterSend` (`web/src/lib/harness/guard.ts`) sleeps through `SETTLE_DELAYS_MS` (60, 80, 120, 160, 240, 240, 300 ms; they sum to `SETTLE_DEADLINE_MS`, 1.2 s), reading the pane after each sleep and returning on the first read whose text differs from the baseline. The wall-clock deadline aborts any read still in flight.

## Decisions

- **Bound: 5 s, a fork-owned constant.** About four times upstream's, long enough for a pane several remote shells away. It lives in `fleet/send-patience.ts` beside the other patience numbers; `guard.ts` imports it (one name), as `api.ts` already does for the send timeout. Longer was rejected because a key that changes nothing holds its card for the whole bound.
- **Read spacing: upstream's list, then its last gap repeated.** The loop indexes `SETTLE_DELAYS_MS` clamped to its last entry instead of iterating it, so the first seven reads are upstream's and later ones come every 300 ms until the deadline. A repaint is seen within 300 ms of landing; a fast pane still settles on the first read.
- **Tests:** upstream cases that pinned "about 1.2 s" or "one read per listed delay" are restated against the exported bound and the repeated gap, with the same intent.
