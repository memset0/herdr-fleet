## Context

Three files plus the newest numbered changelog heading must agree on one version, enforced by
`scripts/check-version.sh` and a pre-commit hook. They currently agree on `1.2.0`, which is Collie's
number for the release this tree reapplies. `UPSTREAM.md`-style provenance already records the exact
Collie commit; what is missing is the statement that the version itself is no longer Collie's.

On the remote, `main` holds the previous generation and `v3-dev` holds this one.

## Goals / Non-Goals

**Goals:** one version line that is this product's; provenance kept explicit; the default branch is
where development happens; nothing rewritten.

**Non-Goals:** adopting a newer Collie; changing behaviour; anything about deployment or the previous
generation's retirement in the consuming repository.

## Decisions

### 1. `3.0.0`, not `1.3.0` or a continuation of Collie's line

The number has to be unambiguous at a glance against two neighbours: Collie's own `1.x`, and the
previous downstream generation's `2.x`. `3.0.0` is the first number that collides with neither and
reads as the generation it is. It is a major because the operator-visible contract changed wholesale
between generations, which is exactly what a major says.

Rejected: continuing Collie's line, which would make the next Collie release a version conflict; and
continuing the previous generation's `2.x`, which would claim an upgrade path from a tree that shares
no deployment, configuration or plugin identity with it.

### 2. Rename the branches rather than move a ref

The archive is created by RENAMING `main` to the archival name, then renaming the development branch
to `main`. A rename moves the default branch with it and leaves every commit and tag untouched.

Rejected: pointing `main` at the development branch's commit. The two lines share no ancestor worth
fast-forwarding, so it is a force-update — the one operation this repository's own agreement says
needs the owner's explicit word, and it would leave the previous generation reachable only by tag.

### 3. Provenance is a record, not a version component

The Collie release this tree reapplies is written where provenance already lives, and the version
files say nothing about it. Encoding it in the version — a build-metadata suffix, say — would make
every upstream adoption look like a release of ours.

### 4. The product's changelog keeps the canonical name; upstream's moves

Two files are required either way. Which one keeps `CHANGELOG.md` is decided by what it costs, and the
costs are not symmetric: the version check and the pre-commit changelog guard both read that filename
directly, and both are upstream-owned. Giving the new name to OUR file means editing both of them —
two new invasive paths, in tooling — while giving it to UPSTREAM's file means editing neither.

So this product's changelog keeps `CHANGELOG.md`, which is also what it now honestly is, and
upstream's is retained verbatim beside it under its own name. That also retires an invasive path
rather than adding two: the existing declaration exists precisely because our entries were being
interleaved into upstream's file, and after this they are not.

Rejected: moving our entries to a new file and repointing the two scripts. It satisfies the same
requirement while spending two invasive edits on upstream tooling to do it, which the minimal-
invasiveness rule this change also records exists to prevent.

## Risks / Trade-offs

- **[A clone or a deployment pinned to `v3-dev` breaks]** → the consuming repository's controller
  resolves a branch by name, so it is updated in the same effort; a rename leaves the old name gone
  rather than stale, which is the failure that gets noticed immediately rather than silently.
- **[Upstream's changelog looks like it was rewritten]** → it is retained byte-identical under its own
  name, and the provenance record names it.
- **[The previous generation looks deleted]** → it keeps its own branch, its tags and its history; the
  archival name states both its own release and the Collie release it carried.

## Migration Plan

1. Bump the three version files and rename the changelog's unreleased heading to `3.0.0` with its
   date, appending each entry's commit hash as the file's own style requires.
2. Record the upstream correspondence as provenance and state the version and branch policy in the
   working agreement.
3. Verify, commit as one release commit, tag it annotated, and push both.
4. Rename the branches on the remote and confirm the default moved.
5. Roll back by renaming the branches back; the release commit and tag are additive and need no
   revert.
