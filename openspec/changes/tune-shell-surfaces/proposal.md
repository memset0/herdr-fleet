## Why

Four measurements came back wrong from the exact Collie `v1.2.0` baseline once the previous change
landed. The hierarchy's new state dot is drawn at the size it wears on a 44px card, one size too
heavy at the end of a 28px tree row. The control row under the mirror kept the height it needed
while its icon sat above its word — 44px for one line of 10px type, with the word's 10px line box
centred against the icon's 16px one, so the two read as misaligned even though their boxes were not.
Moving the rails and the header onto the chrome ground left the resize separators transparent, so
4px of the page shows through as a dark seam down each side of the route column. And an elided row
can still be named by a number: Herdr labels an unnamed Pane with its ordinal, which this shell was
reading as a name the operator chose and preferring over the Tab's real one.

## What Changes

- The hierarchy row's state dot is one size smaller.
- The control row is shorter, its type is larger, and its icon and word share one line box.
- The rail separators take the chrome ground, so the three columns meet without a seam.
- A Pane label that is only digits is treated as the multiplexer's counter rather than a name, so
  the elided row keeps the Tab's name.

Non-goals:

- Any change to what a control does, what a dot means, where the state is drawn, or the elision rule
  itself.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the elided row's naming rule names one more kind of value that
  is not a name.

## Impact

- One rule in the fork-owned navigation model, and three class strings.
- No dependency, route, loader, API call, mutation, backend state, configuration, or fork-boundary
  change.
