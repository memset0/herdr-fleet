## Why

This repository describes its fork boundary but has never written down how a newer Collie release is
adopted. The tree was reapplied from Collie `v1.2.0` (commit `4618c905`) and has stayed there, and
the first adoption since is now due — one that touches 14 of the 17 invasive entries.

Three things are missing, and each is a way the adoption can go wrong quietly:

- `scripts/check-fork.ts` only ever compares the working tree with the baseline already recorded in
  `FORK.toml`. It cannot answer a single question about a candidate release *before* the merge
  starts: whether the tag resolves to what we think, whether our recorded baseline is still its
  merge base, which invasive entries it disturbs, or whether it now ships a path we had declared
  ours.
- Every invasive entry carries `review = "every-upstream-sync"`, and nothing produces those reviews
  or notices their absence. The anchor check is a substring test, so an upstream edit that changes
  what a line *means* while leaving the anchor text intact passes.
- The rule retaining Collie's changelog assumes upstream only ever appends to it. Between `v1.2.0`
  and the current release upstream rewrote its own file, removing more than it added, so "retained
  byte-identical" and "Collie's history is preserved" have stopped being the same statement.

## What Changes

- Add the `fleet-upstream-sync` capability: adoption is an exact release, verified before the merge,
  reviewed entry by entry, merged as real ancestry, and finished only when the boundary and the
  gates agree.
- `scripts/check-fork.ts` gains a `--target <ref>` preflight: it resolves the tag object and its
  dereferenced commit, requires the recorded baseline to be the merge base, refuses to start on a
  dirty working tree, lists every active OpenSpec change and every invasive entry the target
  disturbs, and reports any owned path the target has begun to occupy.
- Active OpenSpec changes stop being a blocker and become something the operator authorizes:
  `--allow-active-changes` says that authorization exists. A dirty working tree stays a hard refusal.
- `FORK.toml` moves to schema 2: every `[[invasive]]` entry carries `reviewed = "<upstream tag>"`,
  and the boundary check fails while any entry lags the adopted release. The existing entries are
  seeded at `v1.2.0`, which is the release they were written against.
- `COLLIE_CHANGELOG.md` becomes accumulative rather than byte-identical: the adopted release's
  changelog sits on top verbatim, entries upstream has since dropped are retained word-for-word
  below it, and one marker line at the seam says where upstream truncated. The adopted release's
  file must remain a byte-exact prefix, so the retention stays machine-checkable.
- State what an adoption does to this repository's specifications: an adoption is itself a change
  here, it updates a downstream capability's specification when the adoption changes that
  capability's behavior, and it never writes a specification for behavior upstream owns.
- `bun run test:fork` joins CI, which today runs only the version check.
- `AGENTS.md` stops naming a branch this repository no longer uses, and its prohibition on merging
  an upstream release becomes a pointer to this procedure rather than a dead end.

Non-goals: this change does not adopt any particular Collie release — it is the procedure the next
change follows. It does not move this product's version line, which `UPSTREAM.md` already separates
from Collie's. It does not describe how a built adoption is deployed or verified on a machine; the
repository's part of an adoption ends at the push.

## Capabilities

### New Capabilities
- `fleet-upstream-sync`: how a newer Collie release is selected, verified, merged, and accepted, and
  what the fork boundary must prove before and after that merge.

### Modified Capabilities

None. The changelog retention rule, the manifest schema, and the boundary tooling live in
`FORK.toml`, `UPSTREAM.md`, and `scripts/`, not in an existing specification, and the tag-push rule
this procedure relies on is already stated in `fleet-release-publication`.

## Impact

- `scripts/check-fork.ts`, `scripts/fork-manifest.ts`, and their focused tests.
- `FORK.toml` (schema version, `reviewed` on 17 entries, the `release-history` contract wording).
- `UPSTREAM.md`, and the `CHANGELOG.md` header sentence that describes its companion file.
- `.github/workflows/ci.yml`.
- `AGENTS.md`.

No product behavior changes: nothing under `bridge/`, `cli/`, `fleet/`, or `web/` is touched, and no
runtime, protocol, or security surface moves.
