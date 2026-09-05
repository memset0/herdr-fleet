## Context

See proposal.md — Why. The mechanics that matter for the approach:

- `scripts/fork-manifest.ts` parses `FORK.toml` with exact key checking and rejects any unknown
  field, so adding a field is a schema change, not an additive one.
- `scripts/check-fork.ts` builds its input from `git ls-tree <upstream.commit>` and
  `git diff --name-status <upstream.commit>`, plus untracked files classified as additions. It is a
  tree comparison against whatever commit the manifest names — it never consults ancestry.
- `scripts/check-fork.ts` already reports `owned entry <id> collides with upstream path <p>`, but
  only for the *adopted* baseline. Against a candidate release it says nothing, because the candidate
  is not an input.
- `bun run test:fork` runs the manifest and boundary tests plus the check itself. Nothing runs it:
  `ci.yml` runs only `scripts/check-version.sh`, and this checkout has `core.hooksPath` unset, so
  `scripts/git-hooks/` — the version guard, the private-facts guard, the tag warning — is inert.
- `COLLIE_CHANGELOG.md` is currently byte-identical to `v1.2.0`'s `CHANGELOG.md`.

## Goals / Non-Goals

**Goals:**

- One entry point for the boundary, in both directions: what the tree is now, and what a candidate
  release would do to it.
- A machine-checkable answer to "has this entry been looked at against the release we are on".
- A changelog retention rule that survives upstream rewriting its own file, and stays checkable.

**Non-Goals:**

- Automating any part of the review itself. The tooling reports and refuses; the decisions are the
  agent's and the operator's.
- Detecting a false authorization. `--allow-active-changes` records a decision the tooling cannot
  verify.
- Any change to product behavior, or to how a release of this product is cut.

## Decisions

### The preflight extends `check-fork.ts` rather than becoming its own script

`--target <ref>` selects preflight mode; without it the existing repository check runs unchanged.

The preflight needs the manifest parser, the owned-glob matcher, the invasive path splitter and the
`git` helper that `check-fork.ts` already has. A second script would either duplicate all four or
force a third module between them, and two entry points describing one boundary drift apart — which
is the same failure the manifest itself exists to prevent. Rejected alternatives: a separate
`scripts/upstream-sync.ts`; a spec with no tooling, which leaves "an owned path the target now
occupies" to be noticed by eye, and it is precisely the class nobody notices.

What preflight mode does, in order, stopping at the first failure:

1. Refuse if the working tree has uncommitted or untracked changes.
2. Resolve `<ref>` as a tag object and to the commit it dereferences to; refuse a ref that is not an
   annotated tag, or whose dereferenced commit is not an ancestor-free exact match of the tag.
3. Refuse unless `git merge-base HEAD <commit>` equals `manifest.upstream.commit`.
4. List active OpenSpec changes; refuse unless there are none or `--allow-active-changes` was passed.
5. Report every invasive entry with at least one declared path in `git diff --name-only
   <manifest.upstream.commit> <commit>`, and every entry with none — the second list is the one that
   is easy to forget, and it is reviewed too.
6. Report every path in `git ls-tree -r <commit>` that matches an `[[owned]]` entry's paths. Any hit
   is an escalation, not a warning.

Preflight reports and exits; it never edits, fetches, or merges.

### The review gate is a `reviewed` field, and the schema goes to 2

Each `[[invasive]]` entry gains `reviewed = "<upstream tag>"`, validated by the same tag pattern as
`upstream.tag`. The repository check fails while any entry's `reviewed` differs from
`upstream.tag`.

This puts the gate in the file that already must move in the same commit as the boundary it
describes, and makes an unreviewed entry visible in a diff rather than in a report nobody generates.
It also self-clears in the right order: recording the new release in `[upstream]` immediately turns
all seventeen entries red, and the adoption cannot be committed until each has been advanced
deliberately.

`schema_version` becomes `2` and the parser requires exactly that. The field is required, so a
schema-1 file must not pass silently; and `exactKeys` would reject the new field anyway. There is one
manifest and one writer, so no compatibility window is needed.

Existing entries are seeded at `v1.2.0` — the release they were authored against, which is what the
field means. Seeding them at the adopted release would be a lie the first adoption then relies on.

`strategy` and `reviewed` are different things and both stay: `strategy` (`keep`/`adapt`/`drop`) is
how the entry currently relates to upstream, `reviewed` is which release it was last weighed against.
The four review verbs in the specification collapse onto three strategies because "replace from
upstream" and "drop" have the same end state — the entry is gone and its paths are upstream's again.

### The changelog retention check lives with the boundary check

`check-fork.ts` requires `git show <manifest.upstream.commit>:CHANGELOG.md` to be a byte-exact prefix
of `COLLIE_CHANGELOG.md`, and — when the retained file is longer — the first non-empty line after
the prefix to be the seam marker:

```
<!-- Retained from an earlier adoption: upstream truncated its own changelog above this line. -->
```

The check belongs here rather than in `check-version.sh` because it reads the adopted upstream
identity from `FORK.toml`, which is fork governance, and because running it on every boundary check
means the retention is verified continuously rather than only during an adoption. No normalization:
the comparison is bytes, so a stray edit to the retained upstream text fails rather than being
absorbed.

The rule holds for the current file with an empty tail, so this lands green.

### `--allow-active-changes` is a boolean

The operator chose one switch over naming each authorized change. It is the simpler contract, and the
audit value is recovered without it: the preflight always prints the active changes it found, so the
run that carried the flag also records what was open when it was given. The cost is accepted — the
flag also covers a change opened later in the same adoption, and nothing detects that.

### The dirty-tree refusal is preflight-only

The ordinary repository check must keep working on a dirty tree; classifying untracked files as
downstream additions is its job during normal development. Only the preflight refuses, because only
the preflight is about to hand the working tree to a merge.

### CI runs the boundary check, and must check out full history

`bun run test:fork` joins `ci.yml`. This requires `fetch-depth: 0` on the checkout step in that job:
the check reads `git ls-tree` and `git diff` against the adopted upstream commit, and the default
shallow checkout does not contain it. The adopted commit is an ancestor of the development branch, so
full history is sufficient — no upstream remote is needed in CI.

## Risks / Trade-offs

- [The `reviewed` gate makes an adoption all-or-nothing: seventeen entries must be advanced before
  anything can be committed] → That is the intent, and the merge is one commit anyway. An adoption
  that must pause can leave the merge uncommitted; the tree is the work in progress.
- [Full-history checkout makes the CI job slower] → One extra fetch on a repository this size, in
  exchange for the boundary check running at all.
- [The seam marker is a fixed string, so an edited marker fails the check] → Intended. The marker is
  a contract with the reader, not a comment.
- [Preflight cannot verify that the operator's authorization exists] → Stated as a specification
  violation rather than a detectable one, and the active list is printed either way.
- [A future adoption could resolve a lightweight tag, which has no tag object] → The preflight
  refuses a ref that is not an annotated tag rather than guessing; upstream tags all releases
  annotated, and a change in that practice should stop an adoption for a decision.

## Migration Plan

The change is repository tooling and documentation only; there is nothing to deploy and no runtime
surface. `FORK.toml` gains `reviewed = "v1.2.0"` on all seventeen entries in the same commit that
moves `schema_version` to `2`, so the manifest is never in a state the parser rejects. Rollback is
reverting the commit.

`scripts/install-hooks.sh` is run in the working checkout as part of this change. It sets
`core.hooksPath` and is not a tracked repository change.
