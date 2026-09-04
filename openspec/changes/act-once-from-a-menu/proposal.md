## Why

The menu inherited the bottom sheet's two-tap confirm on close, and that confirm was designed for a
surface the menu is not. A sheet slides up under a thumb that is still resting on the row it just
long-pressed; its rows are 44px of a surface the finger is already touching, and the gesture that
opened it and the gesture that acts are the same motion continued. Asking again there buys real
protection from a real slip.

A context menu does not exist until a deliberate secondary click has been made, it appears BESIDE the
pointer rather than under it, and reaching a row means travelling to it and pressing again. Those are
the two deliberate acts the sheet's second tap was standing in for. A third ask is asking the operator
to confirm what they have already done twice, which is how a confirmation stops being read.

## What Changes

- The menu's destructive verb runs on the first activation. Its armed state and the blast-radius copy
  that went with it are gone from the menu.
- The bottom sheet is untouched: it still arms, still names how many panes a tab close costs, and
  still asks again, on every device that gets it.

Non-goals:

- Any change to the refusals that actually protect something — the capability gate, the read-only
  refusal and the host write block still decide whether the row is drawn at all.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the row-actions requirement states which surface confirms and
  which does not.

## Impact

- Two fork-owned components.
- No dependency, route, loader, API call, mutation, backend state, or configuration change.
