## Why

The composer's status band is a 14px strip between two rules, and it exists for the two facts it
carries: what the pane is doing, and which machine a reply will land on. The state moved up to the
strip row, which is a row the screen was already spending — and that left the band standing on a
pack install to say one name. A whole row, two rules and 14px for a fact the app bar's right cluster
has room for and no height to spend on it.

It is also the wrong place to read it. The app bar already carries this pane's identity — the space,
the tab, the directory — so the machine belongs in that sentence rather than a thumb's width above
the keyboard.

## What Changes

- The machine a pane writes to is named in the app bar's trailing cluster, beside the pane menu.
- The composer no longer draws it on this screen, so on a pack the band leaves with the state and the
  pane gets its row back. Every other caller of the composer keeps the machine exactly where it was.
- A single-machine install is unchanged: the chip's own hide rule already draws nothing there.

Non-goals:

- Any change to what the chip says, its unreachable treatment, its accessible name, or its hide rule.
- Any change to the state word, the strips, or the band's own animation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-pane-chrome`: the pane's chrome states where the machine is named, alongside where the state
  is.

## Impact

- Two lines in Collie's composer behind one new default-true prop, and one node in the Pane page's
  existing header cluster.
- No dependency, route, loader, API call, mutation, backend state, or configuration change.
