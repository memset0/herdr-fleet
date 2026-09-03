## Why

The Agent rail renders Collie's dashboard card, and the dashboard card is built for the dashboard:
a full-width list a reader is scanning as the page, leading with the pane's own title and putting
the address beneath it. The rail is 320px of chrome beside the work, read at a glance while
something else has the reader's attention, and there the two lines are wanted in the other order —
where the work is, then what it is doing. The card also has no room for the two marks a rail row
needs: the state, which the Agent's own logo displaced when it took the leading slot, and an ordinal
a keyboard shortcut can address.

The hierarchy has a second, smaller problem from the same reading: its indentation spends a whole
disclosure column on rows that have no disclosure, so a leaf's highlight opens with an empty column
before its icon, and the guide line does not line up with the control that opened the level.

## What Changes

- The rail draws its own row instead of Collie's card. Line one is the project in the muted style,
  then the name the operator gave the work in the plain one; the age sits at its trailing end. Line
  two is what the pane is doing. The Agent's logo leads the row with the state badged at its corner
  and the shortcut ordinal at the other.
- The rail keeps Collie's own triage sections, their headings and their order, the browser-local
  favorite store, favorite-first ordering inside each section, and the favorite control.
- Collie's own Agent list and card are untouched, so every other surface that renders them is
  unchanged.
- The hierarchy's guide line lands on the centre of the control that opened its level, its children
  begin one control-width in, and a row with no children draws no disclosure column at all.

Non-goals:

- Changing triage, the favorite store's identity or bounds, the Pane route, the switcher's gesture
  or sheet, or any surface outside the rail and the hierarchy's indentation.
- Binding the shortcut ordinals to actual keys. The badge reserves the affordance; the keys are a
  later change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the Agent surface draws a fork-owned row over Collie's own
  ordering rather than Collie's card, and the hierarchy's indentation is stated exactly.

## Impact

- Fork-owned: a new row component and a shared naming rule, and a rewritten rail.
- No new invasive port; Collie's Agent list and card keep the ports they already had.
- No dependency, route, loader, API call, mutation, backend state, or configuration change.
