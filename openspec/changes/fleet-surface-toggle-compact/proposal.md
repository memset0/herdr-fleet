## Why

The owner finds the footer's Collie/TTYD selector too tall for a desktop rail and wants the terminal
choice written in lowercase, as the tool itself spells it.

## What Changes

Baseline: Collie v1.23.3 as recorded in `UPSTREAM.md`; Fleet 3.23.2.

- The footer selector's two segments are 32px tall on every pointer type (was a 44px floor), with the
  track inset scaled to match; the label reads "ttyd".

Non-goals: the Settings page's surface switch, its labels and every other control are unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the footer selector's height and terminal label.

## Impact

`web/src/components/fleet-pane-surface-toggle.tsx` and its test (fork-owned). Frontend only; PATCH.
