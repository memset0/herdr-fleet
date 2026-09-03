## Why

The Agent rail's row was given the fork's own reading order — WHERE first, WHAT second — and, with
it, a box of its own: no edge, no ground, no shadow, and rows stacked flush against one another. The
order was the part that needed to be ours. The box was not, and drawing it differently made the same
objects read as a different kind of thing on the two surfaces that list them: a Pane is a card on the
dashboard and a bare line in the rail beside it. The rows are also tighter than anything else in the
app that holds a mark, two lines and a control.

So the row keeps its order and gives the box back. Collie already draws exactly this object, with an
edge, the card ground, a shadow, a hover and a press that the whole app is built on; the rail row
wears that treatment, spends the card's own interior padding, and sits apart from its neighbours.

## What Changes

- A rail row's box is Collie's card: the same border, ground, shadow, hover and press.
- The row spends the card's interior padding rather than the tighter one it had, and rows within a
  section stand apart instead of stacking flush.
- The resting state ring is filled with the card's ground rather than the rail's, which is the
  colour it now actually sits on.

Non-goals:

- Any change to the row's reading order, its naming rule, which corner its control and its age sit
  in, the shortcut ordinal, triage, or the favourite store.
- Any change to Collie's own Agent card or to the surfaces that render it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the fork-owned rail row states which parts of its appearance
  are Collie's and which are the fork's.

## Impact

- Two fork-owned components and one assertion in their test.
- No dependency, route, loader, API call, mutation, backend state, configuration, or fork-boundary
  change.
