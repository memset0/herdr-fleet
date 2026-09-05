## Context

See proposal.md — Why. What the preflight established before anything was merged:

```
upstream adoption: v1.5.1 (ba39c05c…) -> v1.5.2 (cea2035e…)
  tag object 38798351a64cae43c03f156c0b80f22f14d50565
  8 invasive entries disturbed by this release
  11 untouched, and reviewed all the same
  no owned path is occupied by this release
```

`git merge-tree`, read-only, predicts conflicts in `CLAUDE.md`, `herdr-plugin.toml`, `package.json`,
`web/package.json`, `web/src/components/agent-chat.tsx`, `web/src/components/app-header.test.tsx` and
`web/src/routes/history.tsx`. Every one is inside a declared entry.

## Goals / Non-Goals

**Goals:**

- The release in this history as ancestry, every port weighed against it, and the fleet running it.
- A decision on the two width ports that is explicit and reversible, rather than absorbed into a
  merge.

**Non-Goals:**

- Redesigning the pane column. This change either keeps the fork's refusal or defers to the owner; it
  does not invent a third geometry.
- Any change to member configuration, roles or enrolment.

## Decisions

### The width ports are kept and adapted, not dropped

`declined-centred-history-column` and the Pane's half under `native-manual-pane-fit-port` exist
because this fork declined upstream's centred 768px column. `3870c1c` turns that cap into a ladder
and argues for it the way the fork argued against it: a mirror has a column count, and a cap
withholds mirror lines. On its own that is the "upstream now does downstream what this port did"
case, and the manifest's own rule would drop the entries.

Two things stop that from being this change's call. The owner chose the current width deliberately
and hours ago; a merge is not where a chosen UI width gets reversed. And the ladder is measured
against a viewport with no rails — inside the Fleet shell the rails have already taken the width the
ladder is handing back, so whether its four steps are right here is a question this change cannot
answer by reading the diff.

So both entries are kept, their `reason` rewritten to argue against the ladder rather than against a
number that no longer exists, and the question is put to the owner as a change of its own.

### Everything else is resolved from the entry that predicted it

Upstream's version of an upstream-owned file is the base; the port is re-applied on top. The
contract conflicts resolve as they did for `v1.5.1`: `CLAUDE.md` stays the symlink, `CHANGELOG.md`
stays ours, the version files keep this product's number, `herdr-plugin.toml` keeps this product's
identity, and `COLLIE_CHANGELOG.md` becomes `v1.5.2`'s changelog with a seam only if upstream has
dropped an entry.

### The adoption is released and deployed in this change

New since the last adoption, and the reason this one is not finished at the push:
`fleet-upstream-sync` now requires the adoption to cut a release of at least MINOR, and mem.conf's
`herdr-device-deployments` requires that release to reach every member, lead first, with a failed
member rolled back alone and the history untouched.

## Risks / Trade-offs

- [Keeping the width ports against a release that argues the fork's own case leaves the tree carrying
  a patch upstream may have made unnecessary] → stated as a decision with its reason, put to the
  owner, and cheap to reverse: dropping them returns two files to upstream's versions.
- [A file that merged cleanly is not a file that still works] → each entry's declared verification
  runs, for all nineteen rather than the eight the release touched.
- [First adoption that deploys: a failure now interrupts three live members rather than none] → the
  order is fixed, each controller gates itself, and a failed member is rolled back alone.
