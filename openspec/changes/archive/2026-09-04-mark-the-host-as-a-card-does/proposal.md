## Why

The rail row names its machine with Collie's own chip, which is right — but with the chip's
`caption` form, which is not. `caption` exists for a LINE OF CHROME TYPE: the composer's 14px status
band, where a bordered box would read as an object dropped into a sentence. A rail row is a card,
and Collie's own dashboard card names the same machine in the same kind of place with the chip's
ordinary form: a bordered, filled tag with the host's tint on its glyph.

It also sat wrong. Line 2 shares a baseline, and a bordered box's baseline is its own text plus its
padding — so the tag hung low and the runs beside it no longer lined up with it.

## What Changes

- The rail row's host marker is Collie's ordinary chip — bordered, filled, tinted glyph — the same
  one the dashboard card draws.
- Line 2 centres its contents instead of sharing a baseline, so the marker sits on the line of the
  text beside it. Both runs there are one size, so nothing else moves.

Non-goals:

- Any change to when the marker is drawn, what it says, its hide rule on a solo snapshot, or its
  unreachable treatment.
- Any change to Collie's host chip or to any other surface that draws it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the Agent row's host marker states which of the chip's forms
  it takes and where it sits.

## Impact

- One fork-owned component.
- No dependency, route, loader, API call, mutation, backend state, or configuration change.
