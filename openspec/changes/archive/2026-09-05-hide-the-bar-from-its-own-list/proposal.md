## Why

The command bar lists the whole catalog, `Open Command Bar` included — and choosing that row does
nothing at all. It sets the bar's mode to the mode it is already in, so the surface does not move,
nothing is acknowledged, and the operator has spent a selection on a row that cannot act.

A palette's list is a list of things you can do from here. A row that is inert from the only place it
can be read is not one.

## What Changes

- Command mode no longer lists `open-command-bar`.
- Every other command stays listed, `open-pane-switcher` included: from command mode that one is a
  real transition, and pane mode lists no commands at all, so there is no second case.
- The command stays bound, invocable and listed in the Settings reference. This hides one row on one
  surface; it does not remove a command.

## Capabilities

### Modified Capabilities

- `fleet-command-bar`: what command mode lists.

## Impact

- Fork-owned: `web/src/components/fleet-command-bar.tsx`.
- Upstream-owned: none.
- No binding, catalog id, or settings document changes; a document that binds `open-command-bar`
  keeps working exactly as it did.
