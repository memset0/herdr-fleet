## Why

Fitting a Pane was split into two controls — the measured columns and a typed row count — and the
owner has asked for it back as it was: one action that measures the width and leaves the height
alone. The row field is withdrawn rather than reworked; there is no partial version of it worth
keeping, and the surface it stood on is a settings row in a drawer, where a second control is a cost
whether or not it is used.

## What Changes

- The rows field, its per-device preference, its settle, and the fork-owned surface that drew both
  controls are removed. Display Settings shows the single `Resize` action it showed before.
- The protected resize stops accepting a row count. It reads the Pane's current viewport rows from
  server-owned state and preserves them, and it refuses any field other than `cols` — which is the
  rule it had before, restored exactly.
- The client sends `{cols}` again.

Non-goals:

- Keeping any half of the withdrawn control behind a flag, a preference, or a hidden field.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-manual-pane-fit`: back to one action, measured columns, and preserved rows.

## Impact

- Reverts the fork-owned rows module, the settings surface, the wire's optional field and the six
  dictionaries' labels; the `FORK.toml` roots and the `CHANGELOG.md` line go with them.
- No dependency, route, backend state, or configuration change.
