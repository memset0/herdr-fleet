## Why

Pane notifications never appeared on a desktop where the installed app stayed open: Collie withholds
a pane's system notification whenever any of its windows reports itself visible, and desktop
browsers report a window visible even when other windows cover it. A window showing a different
pane also withholds it, although the operator is not looking at that pane.

## What Changes

Baseline: Collie v1.23.3 as recorded in `UPSTREAM.md`; Fleet 3.23.1.

- A pane's notification is withheld only while a focused application window shows that very pane
  (same pane, host and session). Otherwise it is shown. Machine alerts and retractions keep Collie's
  behaviour; a push that opens no pane is never withheld.

Non-goals: no change to delivery, subscriptions, titles, tags, tap behaviour or the in-app status.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-web-push-actions`: Fleet decides when a pane notification is withheld.

## Impact

- `web/src/sw.ts` (upstream-owned): the visibility check delegates to a fork-owned helper; declared under its existing `authenticated-navigation-cache`
  entry in `FORK.toml`.
- `web/src/lib/fleet-push-focus.ts` (+ test, fork-owned).
- Frontend bundle only; PATCH axis.
