## Why

The three-line Agent layout still reserves the action column in its footer, so host metadata stops short of the card edge. Extend that footer across the row on the Collie v1.15.0 baseline.

## What Changes

- Align footer host metadata to the card's standard right inset, without the action-column reserve.
- Give tag wrapping the same full footer width while keeping controls above it independent.
- Non-goals: avatar, text, sorting, binding or Todoist changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-pane-tags`: full-width tag/host footer distinct from the two-line action reserve.

## Impact

One owned footer class and focused layout checks. No upstream ports or backend changes; lead-only PATCH.
