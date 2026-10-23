## Why

Mark all seen stamps every pane on its own host, but a peer's pane keeps its unseen mark on screen
until the lead's next periodic sweep of that member: the revalidation that follows reads the lead's
last-good copy of the peer, which the seen read did not touch. Lead panes clear at once, peer panes
lag, and the rail looks as if the action half-failed.

## What Changes

Baseline: Collie v1.23.3 as recorded in `UPSTREAM.md`; Fleet 3.23.1.

- On a lead, Collie's "look now" (`POST /api/refresh`) also asks the crew lead to sweep its members
  before answering, so a refresh reflects what the members hold now rather than at the last tick.
- Mark all seen asks the lead to look now after its seen reads and before it revalidates, so peer
  panes clear in the same revalidation as lead panes.

Non-goals:

- No client-side seen state, no new route, no batch endpoint (the existing requirement keeps
  forbidding them).
- Opening a single peer pane is not changed here.
- No crew wire change; members run nothing new.

Reused upstream behavior: the refresh route, its coalescing, `CrewLead.sweep()` and its
one-sweep-at-a-time guard. Fork-owned behavior: the shell's call order.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: Mark all seen refreshes the lead's view of every member
  before revalidating.

## Impact

- `bridge/server.ts` (upstream-owned): one-line port in `lookNow`; declared in `FORK.toml`.
- `web/src/components/native-navigation-shell.tsx` (fork-owned): call `refreshNow()` before
  `revalidate()`.
- Lead-only backend change: the lead restarts; members are not redeployed (PATCH axis).
