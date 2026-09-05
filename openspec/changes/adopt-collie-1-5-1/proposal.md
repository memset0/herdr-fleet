## Why

The tree has been a reapplication of Collie `v1.2.0` (commit `4618c905`) since the fork began, and
upstream has published three minor releases since. Adopting them now, with the procedure that landed
in `fleet-upstream-sync`, is cheaper than adopting them later: `v1.2.0` is still the merge base, all
fifteen disturbed ports are still small, and no upstream release has yet claimed a path this fork
declared its own.

## What Changes

- Adopt Collie `v1.5.1` — tag object `a326aedc6a44572cea51432545ea5762acc42648`, commit
  `ba39c05c6350a52bcb0a88f118cd0680ff85a1c5` — as a merge whose second parent is that commit.
- Record the new provenance: `FORK.toml`'s `[upstream]`, and one row in `UPSTREAM.md`'s
  correspondence table. This product's version is unchanged by the adoption itself.
- Review all eighteen invasive entries against the release and advance each one's `reviewed` to
  `v1.5.1`, with an explicit keep, adapt, replace or drop decision behind each.
- Resolve the eleven conflicting paths, every one of which falls inside a declared invasive entry:
  `CHANGELOG.md`, `CLAUDE.md`, `herdr-plugin.toml`, `package.json`, `web/package.json`,
  `web/src/components/agent-chat.tsx` and its test, `web/src/components/app-header.test.tsx`,
  `web/src/sw.ts`, and `web/src/test/handlers.ts`.
- Retain Collie's history accumulatively for the first time: `v1.5.1`'s changelog on top verbatim,
  and whatever `v1.2.0` had that upstream has since dropped kept below one seam marker.

What this adoption brings is upstream's, not ours. `v1.3`–`v1.5` add Collie's own pack-update
orchestration, its updates page and update band, a QR pairing flow, and a long tail of fixes. Those
are Collie features that arrive with the merge and stay upstream behavior; this repository neither
specifies them nor claims them.

Non-goals: no specification is written for behavior upstream owns. This adoption does not cut a
release of this product, does not change the Fleet lifecycle posture — Fleet still runs no
operating-system service and never invokes Collie's own CLI verbs against a Fleet deployment — and
does not deploy or verify anything on a machine, which is not this repository's to state.

## Capabilities

### New Capabilities

None. An adoption imports upstream behavior, and upstream behavior is not specified here.

### Modified Capabilities

None expected. The eleven conflicts all sit in ports whose downstream intent is unchanged by the
release, and the fork's navigation does not enumerate the settings destinations upstream added. If
the entry-by-entry review shows that a capability this repository does specify now behaves
differently, its delta is added to this change before implementation continues, per
`fleet-upstream-sync`.

## Impact

- Everything Collie changed between `v1.2.0` and `v1.5.1`: 89 commits over 210 files, mostly under
  `bridge/`, `cli/` and `web/src/`.
- `FORK.toml` — `[upstream]`, and `reviewed` on all eighteen entries.
- `UPSTREAM.md`, `COLLIE_CHANGELOG.md`, `CHANGELOG.md`.
- No change to `fleet/`, which is the fork's own runtime and which the release does not touch.
