## Why

Every member of the roster is now a row in the hierarchy — present or absent, holding panes or not.
That makes this list the place the operator asks "which machines do I have, and is one of them
down?", and the list answered neither. A Host row led with the same disclosure arrow every other row
leads with: a control for a state the row's own children already show, occupying the one column where
the machine's identity would be worth something.

A member that is configured and not answering was therefore indistinguishable from one that is fine
and simply collapsed.

## What Changes

- A Host row draws the machine itself where the arrow was: Collie's own server glyph, in that
  machine's own tint — the same slot every other host-aware surface in Collie tints by.
- When the machine stops answering, the glyph changes and the row says so in words at its trailing
  end, in the same position a Pane row's state takes. Colour alone never carries it.
- The row still discloses on click; its disclosure state moves onto the row's own label, which is
  the only control left on it.

Non-goals:

- Any change to which members are listed, their order, what a member's subtree contains, or what a
  row's actions offer.
- A second health model. The reading is Collie's own host health, unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the Host row states what it draws and what it reports.

## Impact

- One field and one icon kind in the fork-owned navigation model, and one fork-owned component.
- No dependency, route, loader, API call, mutation, backend state, or configuration change.
