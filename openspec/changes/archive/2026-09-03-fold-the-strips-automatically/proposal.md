## Why

On a phone the pane screen already folds its two strips by itself while the keyboard is up, and it
also offers a manual control that folds the same rows. Two ways to reach one state is one the
operator has to keep in their head, and the manual one costs a control in a 44px row that has other
work to do.

The fold also loses the pane's state. The badge lives at the tab row's trailing end, so folding the
row takes it away, and the composer's band comes back to say it — which is the row this shell
removed in the first place, reappearing at exactly the moment the screen has least space.

Two smaller readings came back with it: the Agent rail's row puts its favourite control and its age
in one column when they belong at opposite corners, and the hierarchy's phone drawer is a second
design of a surface the desktop already has.

## What Changes

- The manual fold control is removed from the tab row. The fold stays automatic, and expanding is
  still one tap on the whole folded bar.
- The folded bar carries the pane's state at its trailing end, as a word rather than a badge: the
  bar is 24px and a pill does not fit it.
- The composer's status band therefore returns only where no strip surface exists at all — a pane
  with no strips, or zen.
- The Agent rail's row puts the favourite control at its top-right corner and the age at its
  bottom-right.
- The hierarchy's phone drawer wears the rail's own ground and title, so it is the same surface
  arriving from the edge rather than a second one.

Non-goals:

- Changing when the fold happens, the bar's beads, its accessible name, zen, or the gesture that
  expands it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-pane-chrome`: the state survives the fold, and the fold has one way to reach it.
- `fleet-native-navigation-sidebars`: the phone's hierarchy surface is the rail's own.

## Impact

- Fork-owned: the rail's row and the shell's drawer.
- Invasive: one trailing slot on Collie's folded strips bar, beside the two ports the Pane page
  already carries.
- No dependency, route, loader, API, backend state, or configuration change.
