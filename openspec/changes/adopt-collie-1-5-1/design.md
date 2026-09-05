## Context

See proposal.md — Why. What the preflight established, before anything was merged:

```
upstream adoption: v1.2.0 (4618c905…) -> v1.5.1 (ba39c05c…)
  tag object a326aedc6a44572cea51432545ea5762acc42648
  15 invasive entries disturbed by this release
  3 untouched, and reviewed all the same: native-pane-chrome-port, private-fact-guard-port, fork-gate-in-ci
  no owned path is occupied by this release
```

`git merge-tree` — read-only, before the merge — reports eleven conflicting paths, and every one of
them is inside a declared invasive entry. That is the boundary working: where this fork edited an
upstream file, the release met it; where it did not, upstream's change applied on its own.

## Goals / Non-Goals

**Goals:**

- The adopted release is in this history as ancestry, so the next adoption is a three-way merge.
- Every port is weighed against what upstream now does, including the three the release never
  touches.
- Upstream's new behavior arrives as upstream's, unspecified and unclaimed here.

**Non-Goals:**

- Cutting a release, deploying, or verifying a deployment.
- Improving any port beyond what the release requires of it. A port that still reads well after the
  merge is kept as it is, and an improvement it suggests is a later change.

## Decisions

### The merge is real, and made on `main`

`git merge v1.5.1` with the tag's dereferenced commit as the second parent, conflicts resolved in the
working tree, committed only once every gate passes. No squash, no rebase, no cherry-pick — the merge
base is what the next adoption needs, and `v1.2.0` being the current one is what made this adoption
cheap.

### A conflict is resolved from the entry that predicted it

Each conflicting file belongs to an invasive entry whose `reason` already states what the fork wanted
there and how narrowly it wanted it. The resolution takes upstream's version of the file as the base
and re-applies that port on top — never the reverse, and never a merge of the two texts that keeps
both shapes. Where the port has become unnecessary, it is dropped and the entry goes with it.

The four resolutions that are settled before the merge opens, because they are contracts rather than
code:

- `CLAUDE.md` — upstream ships a regular file; here it is a relative symlink to `AGENTS.md`, which
  is the stated convention. The symlink is kept, and upstream's new content is not read into it.
- `CHANGELOG.md` — ours entirely. Upstream's new entries belong to `COLLIE_CHANGELOG.md`, and the
  adoption's own line goes under `## [Unreleased]` like any other functional change.
- `package.json`, `web/package.json`, `herdr-plugin.toml` — upstream's changes to everything except
  the version, which stays this product's `3.1.1`. `scripts/check-version.sh` is the check.
- `COLLIE_CHANGELOG.md` — `v1.5.1`'s changelog verbatim on top; whatever `v1.2.0` had and `v1.5.1`
  dropped kept word-for-word below the seam marker. `check-fork.ts` verifies the prefix.

### Every entry is reviewed, and the three untouched ones are not exempt

The fifteen the release disturbs are reviewed because they conflicted or because upstream moved the
file under them. The three it leaves alone are reviewed because upstream can make a port unnecessary
from a distance — a behavior it did downstream is now done upstream, and the patch that carried it
should go rather than be carried forward unexamined.

Each entry ends with one decision and its declared verification passing, and then records `v1.5.1`.
The gate is mechanical: the boundary check fails while any entry still says `v1.2.0`.

### Upstream's new features are adopted, not specified

`v1.3`–`v1.5` bring Collie's pack-update orchestration, an updates page, an update band and a QR
pairing flow. They arrive with the merge and work as upstream wrote them. No specification is added
here for any of them, and no fork module is written to wrap one. Where one of them touches a surface
this fork does own — the settings page it adds a row to, the service worker it caches through — the
port on that surface is what gets reviewed, not the feature behind it.

## Risks / Trade-offs

- [A file that merged cleanly is not a file that still works: upstream may have moved what a port
  depends on without touching the port's own lines] → the per-entry verification is what catches
  this, and it runs for all eighteen entries rather than only the conflicted ones.
- [Upstream's update surfaces could offer a Fleet deployment an action it must not run] → the fork's
  posture is already specified and unchanged; the review checks the surfaces the fork owns, and
  anything further is a later change with its own decision.
- [The pack harness suite hangs and fails one case in this checkout, before this change] → it is
  pre-existing and touches nothing the adoption resolves, but it does mean the root suite cannot be
  the adoption's gate; the suites the merge can reach are run instead, and the gap is reported rather
  than papered over.
- [Eighteen entries reviewed in one change is a long apply] → it is one merge and cannot be split
  without leaving the tree half-adopted; the manifest gate makes an unreviewed entry impossible to
  commit rather than easy to forget.
