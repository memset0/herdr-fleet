## Why

`fleet-upstream-sync` says an adoption ends at the push, and that is where the Collie `v1.5.1`
adoption stopped: merged, verified, pushed, and then nothing. Whether the fleet ran it was a separate
act somebody had to remember, and the version files still claimed the number they claimed before the
adoption, so nothing in the repository could tell an adopted tree from an unadopted one.

The owner has settled it: an adoption is released, and a release means every machine redeploys. The
version line is exactly where that belongs — this product's number already means "how far the change
has to travel", and an adoption travels to every member.

## What Changes

- An adoption cuts a release of this product, in the same change as the merge, following the release
  recipe this repository already has.
- Its axis is at least MINOR. An adoption replaces what every member of a pack executes, and MINOR is
  this product's word for that; calling one a PATCH would tell the operator the lead alone needs
  levelling, which for an adoption is never true. A MAJOR remains the owner's to cut by hand.
- The repository's part in an adoption ends at the push of that release commit and its tag — not at
  the push of the merge. What the release must then prove on a machine stays outside this
  repository, and this repository will not call an adoption complete on the strength of a push.

Non-goals: nothing changes about how the merge itself is made, reviewed, or verified, and no
deployment behavior is described here — a public repository cannot name the machines that run it.
This change does not cut the release for the `v1.5.1` adoption, which the owner has already handled.

## Capabilities

### Modified Capabilities

- `fleet-upstream-sync`: the adoption continues into a release, its axis is fixed at a floor rather
  than judged case by case, and the boundary of this repository's part moves from the merge's push
  to the release's.

## Impact

- `openspec/specs/fleet-upstream-sync/spec.md` — one modified requirement, one added.
- No source, no tooling, no manifest. Nothing under `bridge/`, `cli/`, `fleet/`, `web/`, or
  `scripts/` is touched.
