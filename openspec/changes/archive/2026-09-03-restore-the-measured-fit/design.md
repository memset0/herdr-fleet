## Context

See proposal.md — Why. The split shipped one release ago and its whole surface — the module's row
bounds and preference, the component that drew both controls, the wire's optional field, the client
call, the labels — was added by a single change, so removing it is that change inverted rather than a
new design.

## Goals / Non-Goals

**Goals:**

- Return the observable behavior to exactly what it was, including the request body's shape and the
  parser's refusal of any field but `cols`.

**Non-Goals:**

- Leaving a dormant `rows` path on the wire "in case". A field nothing sends is a field nobody
  validates the meaning of, and it would have to be defended at the next upstream sync for nothing.

## Decisions

### Invert the change rather than write a new one

The withdrawal is `git revert` of both of that change's commits, so no line survives by accident and
the diff is reviewable as "the inverse of what landed". Its archived record stays where it is: the
history says the split was made and this says it was withdrawn, which is the honest pair.

### The audit and the controller are untouched

Neither ever learned about the split: the controller has always taken a `{cols, rows}` pair and the
audit has always recorded both. What changes back is only where the rows come from — server-owned
Pane state, never a request.

## Risks / Trade-offs

- [The height remains unreachable from the phone] → It is the behavior the owner asked for, and the
  wire's own bounds are unchanged, so a future change can offer it again without a migration.
