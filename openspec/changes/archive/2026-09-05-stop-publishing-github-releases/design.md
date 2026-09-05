## Context

See proposal.md — Why.

Three facts decide the shape.

**The trigger is the whole mechanism.** `.github/workflows/release.yml` runs `on: push: tags:
["v*.*.*"]`. Everything below that line — the platform matrix, the integrity manifests, the `.sha256`
sidecars — is the payload recipe and has nothing to do with when it runs.

**Nothing here consumes what it produces.** `bridge/index.ts` sets the update repo from
`COLLIE_UPDATE_REPO` and falls back to `AltanS/collie`; this fork sets that variable nowhere, and
`scripts/install.sh` defaults the same way. The banner also polls the *tags* endpoint rather than
`releases/latest`, so it is unaffected by whether Releases exist at all.

**The working agreement currently mandates the opposite**, in a MANDATORY section: *"Publish every
release you cut — tag it when you push it … an untagged version exists only as a CHANGELOG heading
and nobody can install it."* That is upstream's reasoning, and it is sound for a product installed
from Release assets. This one is installed as a Herdr plugin.

## Goals / Non-Goals

**Goals:**

- No push can publish, whatever tag it carries and whoever pushes it.
- Tagging is unchanged, so the version markers and the checks that guard them keep working.
- A reader who wonders why the trigger is gone finds the answer at the trigger.

**Non-Goals:**

- Changing what the workflow builds, or removing it.
- Touching the update banner, the binary updater, or `scripts/install.sh`.
- Deleting Releases that already exist.

## Decisions

### The trigger becomes `workflow_dispatch`, and the recipe stays

One key changes. The workflow keeps every job it has and can still be run, by a person, from the
Actions tab.

*Alternative considered: delete the file.* Rejected on the fork's own minimal-invasiveness rule. The
file is upstream's and is large; deleting it is a large permanent diff that has to be re-resolved at
every sync, and it destroys a recipe that is expensive to reconstruct and costs nothing to keep. The
requirement is that nothing publishes *automatically*, and a file that only runs when a human presses
a button satisfies it.

*Alternative considered: keep the trigger and stop pushing tags.* Rejected, and it was the owner's
call: tags are this product's version markers, `scripts/check-tag.sh` and the pre-push hook exist to
insist on them, and the update check reads them. Removing tags to avoid publishing would break three
working things to disarm one.

*Alternative considered: narrow the tag pattern* so only some tags publish. Rejected: it leaves
publication automatic and merely changes which push triggers it, which is the property being removed.

### The rule is written where the opposite rule is

The MANDATORY publish paragraph in `AGENTS.md` is rewritten rather than annotated. Leaving it and
adding a contradiction elsewhere is how the next agent publishes a Release and cites the file for it.
The replacement keeps the tag half — which is still true and still enforced — and states why the
publish half does not apply to a Herdr-installed product, so the rule carries its own reason as this
file's conventions require.

`scripts/check-tag.sh`'s two comments describing the tag as what the release workflow waits for are
corrected in the same change, for the same reason: a comment that asserts a trigger which no longer
exists is worse than no comment.

### The workflow gets its own manifest entry

`.github/workflows/release.yml` is upstream-owned and has never been touched downstream, so it has no
entry. It gets one rather than joining an existing entry, because it is the only path this capability
changes and its reason — that the removal of the trigger IS the point, and a sync must not restore it
— has nothing to do with any other entry's subject.

## Risks / Trade-offs

- **An upstream sync silently restores the trigger**, because upstream's version of this file is the
  one with it. → `review = "every-upstream-sync"` plus a reason that says in words what a careless
  resolution costs. The trigger line is also the file's most conspicuous hunk.
- **A future change makes this product read its own Releases** — a self-hosted install path, say — and
  finds nothing there. → Stated as a requirement rather than left implicit: such a change must restore
  a way to publish, or not be made.
- **The build recipe rots unnoticed**, since nothing exercises it any more. → Accepted. It is
  upstream's file and upstream exercises it on every one of its own releases; this fork is not the
  place that would catch a break in it first.
