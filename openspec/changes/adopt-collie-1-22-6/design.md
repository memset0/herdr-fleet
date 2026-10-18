## Context

See proposal.md, "Why". The ground was read before anything changed:

```
baseline  v1.20.1  tag f8ce7bd4…  commit 3c08e4f2…   (FORK.toml [upstream]; = merge-base main v1.22.6)
target    v1.22.6  tag a2ada8ff…  commit 9cc40c8a…   1224 files (v1.20.2 … v1.22.5 included)
preflight (bun scripts/check-fork.ts --target v1.22.6, before this change existed, no active change):
          28 of 30 invasive entries disturbed; 2 untouched; no owned path occupied
boundary  bun run test:fork: 21 pass; 1001 owned and 70 invasive paths
```

Upstream's changelog was not truncated: `v1.22.6`'s `CHANGELOG.md` carries `v1.20.1`'s text below its
new releases unchanged, so `COLLIE_CHANGELOG.md` becomes `v1.22.6`'s file verbatim, with no seam.

## Goals / Non-Goals

**Goals:** `v1.22.6` as real ancestry, every port reviewed; the fork's own Codex reader port retired
and upstream's readers proven on real Codex and Claude Code panes; every fork feature working on the
new send pipeline, through the Gateway and across the crew; the fork's look kept under the default
theme and the shell legible under the others; the invasive count not grown.

**Non-Goals:** as in proposal.md.

## Decisions

Recorded as the work proceeds; each section names what was decided and why.

## Risks / Trade-offs

- A screen upstream's reader does not read on this operator's agents becomes visible as a refused or
  two-tap send rather than being patched. The owner accepted that; the evidence goes to the owner.
- A mixed-version crew refuses checked text to an older member until it updates, so the rollout order
  is lead first, then each member, with a send verified on each.
