## Why

Collie v1.22.6 puts a send it may not type yet in a per-pane hold queue and types it once a poll reads the pane free, often only when the turn ends ("Queued. Sends when the turn ends."). In production the queue mostly caught sends that the harness could have taken at once (a Claude turn whose footer moved under the probe, a Codex screen read as unreadable for a moment), so messages sat for minutes behind long turns. The operator wants a send to go in now or be refused now.

## What Changes

- No refused send joins the hold queue: the refusal (turn running on a harness that cannot take a message, a box not free, a probe that met a moving screen) is answered at once with its reason and offers.
- A new send never waits behind requests already held; those still drain through the release poll and can still be cancelled.
- Sends that can go into a running turn are unchanged: a queueing harness's own queue, Codex's steering Enter.

## Capabilities

### New Capabilities
- `fleet-no-send-hold`: Fleet answers every send at once instead of holding it.

### Modified Capabilities
None.

## Impact

Baseline Collie v1.22.6. Upstream-owned path: `bridge/surface/protocol.ts` (one import, the switch in `holdsEnd` and in the join check) and `bridge/surface/protocol.test.ts` (one line turns Collie's queue on for its own cases; Fleet's cases added). Fork-owned: `fleet/send-holds.ts` and its test. The bridge changes, so this is a MINOR release. Cost accepted: a send refused in a turn must be sent again by the person.
