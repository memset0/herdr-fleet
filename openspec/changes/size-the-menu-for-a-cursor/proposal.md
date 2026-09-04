## Why

The menu is its own component now, but it was still built to the sheet's measurements: 288px wide,
44px rows, and a caption across the top naming the row it acts on. Those are a thumb's numbers on a
surface that only exists where there is a cursor, and three verbs in that box read as a panel rather
than a menu.

The caption is the worse half. A sheet has to print the target because it covers the app — the row
you came from is gone, and you need telling which one you landed on. A menu is standing ON that row,
a few pixels from the name it repeats, in the one surface with the least room to spend. The reader
who genuinely cannot see the row is a screen reader, and that reader is served by the menu's name
rather than by drawn text.

## What Changes

- The menu is 176px wide with 24px rows and 12px type — a desktop context menu's measurements.
- The caption is gone. The target stays as the menu's accessible name, so nothing is lost to
  assistive technology.

Non-goals:

- Any change to which verbs appear, what they do, or the bottom sheet, which keeps its own title row
  and its own density on every device that gets it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the row-actions requirement states the menu's density and how
  it names its target.

## Impact

- Two fork-owned components.
- No dependency, route, loader, API call, mutation, backend state, or configuration change.
