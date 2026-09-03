## Why

Two surfaces are not doing what their requirements already say, and both failures have the same
shape: a number that was correct became wrong when a neighbouring one moved, and nothing recomputed
it.

The hierarchy's guide line is specified to fall on the centre of the control that opened its level.
It did, until the row gained horizontal padding of its own: the chevron moved 6px right and the line
stayed where it was.

The Agent rail's row is specified to put its favourite control at the top trailing corner and its
age at the bottom trailing one. The reserve that clears the control was put on the whole row button
instead of on the line that shares it, so the second line was pushed in by the control's full width
and the age stopped reaching the corner.

## What Changes

- The hierarchy's guide line and its children's indentation are recomputed from the row's padding
  and the chevron's width, and the arithmetic is written down at the line so the next change to
  either input moves both.
- The Agent row's reserve for the favourite control moves from the button to the first line, so the
  second line runs to the row's own trailing edge.

Non-goals:

- Any change to what either requirement asks for. Both already say what should be on screen.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. `fleet-native-navigation-sidebars` already requires the guide line to fall on the control's
centre and the row's controls and facts to sit at opposite corners; this change makes the
implementation match, so it declares `skip_specs`.

## Impact

- Three class strings, and one focused test pinning the reserve to one line.
- No dependency, route, loader, API, backend state, configuration, or fork-boundary change.
