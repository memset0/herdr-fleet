## Why

A wordless strip appears across the top of the phone when a Pane is opened from the dashboard, and
not when one Pane is switched for another. It was diagnosed as Collie's busy bar surfacing the
navigation half of its two slow-load thresholds, and that half was turned off for this shell. The
strip is still there, so the diagnosis was wrong: the change removed a signal that was not the one
being seen, and it should not stand on a reason that turned out to be false.

## What Changes

- The busy bar's navigation signal is restored exactly as Collie ships it, and the option to decline
  it is withdrawn from the hook.
- The requirement that shell reports its own route changes is removed, since nothing now implements
  it and the observation behind it was not what it claimed.
- The hierarchy's density and padding, which landed in the same change, are kept: they were asked
  for on their own and are unaffected by the misdiagnosis.

Non-goals:

- A replacement fix. The strip is not yet identified, and guessing a second time would be the same
  mistake with a different file.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the route-change requirement is withdrawn.

## Impact

- Reverts one optional parameter on Collie's slow-load hook, its test, the root route's call, and the
  two `FORK.toml` anchors that recorded it.
- No dependency, route, backend state, or configuration change.
