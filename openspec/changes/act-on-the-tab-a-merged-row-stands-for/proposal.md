## Why

A Tab holding one Pane gets no row of its own — the Pane takes its slot, under the Tab's name
whenever nobody named the Pane, which on a herd is nearly always. The operator reading that tree sees
a tab with one pane in it. Right-clicking it offered the PANE's actions: rename opened the pane's
label, and close closed the pane.

Both are wrong for that row, and wrong in the way that costs something. Renaming edited a value that
is not the one on screen — the row still showed the Tab's name afterwards, so the rename appeared to
do nothing. Closing removed the Pane and left its Tab behind holding nothing.

## What Changes

- A row that stands in for an elided single-Pane Tab acts on the TAB: its rename names the Tab and
  its close closes the Tab.
- What the row OPENS is unchanged — the Pane, because a Tab has no route of its own.
- A Pane row that is one of several under a Tab is unaffected, and so is a Tab row that kept its own
  row.

Non-goals:

- Any change to the elision rule, to which name the row takes, to the icon it draws, or to any write.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the row-actions requirement states what a merged row acts on.

## Impact

- One field in the fork-owned navigation model.
- No dependency, route, loader, API call, mutation, backend state, or configuration change.
