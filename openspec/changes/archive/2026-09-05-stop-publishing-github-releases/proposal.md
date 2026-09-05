## Why

The owner has asked that this project never publish a GitHub Release again.

In the Collie v1.2.0 baseline this fork reapplies, publishing is automatic and unattended: pushing a
`vX.Y.Z` tag fires `.github/workflows/release.yml`, which builds per-platform payloads and creates
the Release. Nobody decides to publish; a tag decides it. That is what made cutting 3.0.1 also push
five of upstream's own tags into this fork's remote, each of which fires the same workflow and would
build a Release for a Collie version this product never shipped, under this product's name. The tags
were deleted; the way a tag turns into a publication was not.

It costs this product nothing to stop. The Release assets serve the binary install path and the
in-app update banner, and **both read `AltanS/collie`** — `bridge/index.ts` defaults the update repo
there and this fork never sets `COLLIE_UPDATE_REPO`. Nothing in this product reads this fork's own
Releases. This deployment is a Herdr plugin, whose updates are Herdr plugin actions.

## What Changes

- Stop the automatic publication. The workflow keeps its build recipe and loses the trigger that runs
  it without anyone asking, so a Release can only ever be an explicit human act.
- Keep tagging every release. A tag is this product's version marker — `scripts/check-tag.sh` and the
  pre-push warning exist to make sure one is cut, and the update check reads tags rather than
  releases — so nothing about tagging changes except that a tag no longer publishes anything.
- State the rule in the working agreement, which currently mandates the opposite: it says to publish
  every release cut, because a version nobody can install is not a release. That reasoning is
  upstream's and it does not hold for a product installed through Herdr.
- Correct the two comments in `scripts/check-tag.sh` that describe the tag as the thing the release
  workflow waits for.
- Declare the workflow in the fork boundary, which has not needed an entry for it until now.

**Non-goals.** The workflow's build recipe, its matrix, its integrity manifests and its asset naming
are untouched — this changes when it runs, not what it produces. No change to `bridge/update.ts`,
`cli/update.ts`, `scripts/install.sh` or the update banner: they read upstream's repo and are correct
as they stand. Releases that already exist are left alone. Version tags keep being cut and pushed.

## Capabilities

### New Capabilities

- `fleet-release-publication`: what cutting a release does and does not do here — that a tag marks a
  version without publishing it, and that publication is never automatic.

### Modified Capabilities

None.

## Impact

- **Fork boundary.** `.github/workflows/release.yml` is upstream-owned and undeclared; it gains an
  invasive entry. `AGENTS.md` is already declared under `repository-guidance`.
- **Upstream divergence.** Upstream publishes on a tag and will keep doing so, so this hunk conflicts
  at every sync. The entry's reason is where a reader learns the trigger's removal is the point.
- **Nothing to redeploy.** No runtime code changes, so no machine needs levelling; this is a
  documentation and CI-trigger change and warrants no release of its own.
