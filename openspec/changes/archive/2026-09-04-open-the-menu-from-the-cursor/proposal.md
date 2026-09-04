## Why

The menu opened at the cursor, and then it opened WRONG. Two faults, both from the same source —
it was a bottom sheet standing somewhere else rather than a menu:

- It grew from its own CENTRE, because that is a box's default transform origin. A box pinned by one
  corner and scaled from its middle reads as being squeezed in from all four sides at once; the
  operator's word for it was that the motion felt strange. A menu opens OUT OF the cursor.
- It kept the sheet's chrome: a sticky, frosted title bar with a 14px semibold title and a 32px ✕
  over four verbs. That is the header of a surface you have entered and need a way out of. A menu is
  a small box beside the row it is about, dismissed by Escape, by a click anywhere else, or by
  looking away, and a close button on it makes it read as a tiny dialog.

And the choice between the two surfaces was being made by the GESTURE — a mouse-typed press before
the context event. That is nearly the device question and not quite it: a phone browser can raise a
context menu off a press typed anything at all, and a 288px box pinned to a coordinate is the wrong
surface for a thumb no matter what raised it.

Separately, the phone's hierarchy drawer covers all but a sliver of the screen at 90vw, which reads
as a route change rather than a panel — and the rows inside it are short names that never needed the
width.

## What Changes

- The menu grows out of the corner the cursor is on, which the placement now names because only the
  flip knows which corner that is.
- At the cursor the panel wears a menu's chrome: a caption naming the target instead of a title bar,
  no close button, no sticky frosting, and a tighter body. The bottom sheet and the centred dialog
  are untouched.
- The DEVICE decides which of the two surfaces exists — a machine with a fine pointer that hovers —
  and the gesture only decides where the chosen one stands. A recorded gesture is claimed either way,
  so a phone's can never place something later.
- The phone's hierarchy drawer is narrower, leaving a real strip of the page to tap back to.

Non-goals:

- Any change to which actions exist, what they do, their gating, their refusals, or any write.
- Any change to the bottom sheet or the centred prompt.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the row-actions stand says how the menu arrives, what chrome it
  wears and who chooses it; the phone's hierarchy drawer states its width.

## Impact

- One fork-owned geometry module, one fork-owned hook, and the placement branch of Collie's sheet
  primitive.
- No dependency, route, loader, API call, mutation, backend state, or configuration change.
