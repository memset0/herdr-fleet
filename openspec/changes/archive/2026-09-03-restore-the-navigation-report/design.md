## Context

See proposal.md — Why. The withdrawn change added one optional parameter to Collie's `usePollBusy`
and passed it from the root route.

## Goals / Non-Goals

**Goals:**

- Put Collie's hook back exactly, and keep the unrelated work that shipped alongside it.

**Non-Goals:**

- Identifying the strip. That is the next task and it starts from observation, not from another
  reading of the code.

## Decisions

### Hand-revert rather than `git revert`

The same commit also tightened the hierarchy's density and padding, which the owner asked for and
still wants. A commit-level revert would take those with it, so the three busy-bar edits, the two
manifest anchors, the changelog line and the requirement are removed by hand and the rest is left
alone.

### The requirement is REMOVED, not modified

A requirement whose justification was a wrong diagnosis should not survive in weakened form: there
is nothing left that is true about it. Its removal records why, so the next reader does not
re-derive the same wrong cause from the spec.

## Risks / Trade-offs

- [The strip is still on screen] → Named as open rather than papered over. The next step is one
  observation from the owner — what the strip looks like — not another pass over the code.
