## Why

The v3 line has carried Collie's own version number since it began, because it began as a
reapplication of one exact Collie release and had nothing of its own to number. It now has: an
authenticated gateway, a role-aware supervisor, a Pack authority boundary, a reachability transport,
an enrolment path and a navigator that presents a whole pack. Those are this product's, they version
on this product's axis, and a number that tracks Collie's cannot say when one of them changes.

The branch layout says the same thing backwards. `main` is the previous generation and development
happens on `v3-dev`, so the default branch is the line nobody is building on and every clone starts
on the wrong one.

## What Changes

- Take this product's own version line, beginning at `3.0.0`, and record which exact Collie release
  the tree corresponds to so the two are never confused again. The correspondence is provenance, not
  a version: a later Collie release changes it without changing ours.
- Make the development line the default branch, and archive the previous generation under a branch
  named for what it was — its own release and the Collie release it carried.
- State in the working agreement that this repository's version is its own from here, and that the
  default branch is where development happens.
- Separate the two changelogs: upstream's is retained exactly as upstream wrote it, this product's is
  its own file, and the working agreement tells an agent which one to write in.
- State this product's own release policy: the version moves on an axis of which machines a change
  obliges to redeploy, that axis decides who may cut the release, and every verified change is
  assessed against it rather than releases being remembered.
- State the boundaries the fork is maintained by, which have been practice without being written:
  invasiveness is minimised rather than merely declared, `FORK.toml` moves with the boundary it
  describes, upstream's own decision records are never edited, and the working agreement governs any
  conflict rather than the call site resolving it silently.

Non-goals:

- Adopting a newer Collie release, or any change to what the code does.
- Rewriting history, force-updating a branch, or deleting the previous generation's commits or tags.
- Deployment, which is the consuming repository's, and the previous generation's retirement there.

## Capabilities

### Modified Capabilities

- `fleet-plugin-runtime`: Record that the downstream version line and default branch are this
  product's own, state the release policy that line moves by, and state the fork-boundary rules the
  manifest and the upstream decision records are maintained by.

## Impact

- Changes the three version files, the changelog heading, the provenance note and the working
  agreement; adds one annotated tag.
- Renames two branches on the remote and moves the default branch. No commit is rewritten, no branch
  is force-updated, and every existing tag keeps pointing where it points.
