## Why

Opening a Pane from the dashboard on a phone puts a wordless strip across the top of the viewport.
It is Collie's busy bar, surfaced by the navigation half of its two slow-load thresholds: a route
change still in flight past half a second is user-blocking, so the bar says so. That reasoning holds
for the app it was written for. It does not hold under this shell — the rails and the header stay
mounted across every route change, so the screen never goes blank, and the arriving route draws its
own chrome and its own loading state. The one navigation that regularly crosses the threshold is the
first fetch of a Pane's mirror, which is exactly the screen that already says it is loading.

Two readings of the hierarchy came back with it: on a phone its rows are twice the height they are
on a desktop, so the same list is a different surface depending on the width; and a row's own
horizontal padding is too tight now that a leaf draws no disclosure column.

## What Changes

- The shell leaves route changes to its own chrome: the busy bar no longer surfaces a navigation.
  The ambient half is untouched — a poll that has genuinely hung still surfaces it, because nothing
  else on the screen says so.
- The hierarchy has one row density at every width, the compact one.
- A hierarchy row has more horizontal padding.

Non-goals:

- The mutation counter, the Collie mark's orbit, the poll's own threshold, or the density of any
  surface a thumb aims at — the Agent rail's rows, the strips and the composer's controls keep their
  own floors.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the shell reports its own route changes, and the hierarchy has
  one density.

## Impact

- Invasive: one optional parameter on Collie's slow-load hook, and the root route passing it.
- Fork-owned: the hierarchy's row metrics.
- No dependency, route, loader, API, backend state, or configuration change.
