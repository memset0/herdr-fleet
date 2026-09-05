## Context

The slot this changes was introduced one change ago, when Pane search widened from the Pane's own
name to the four facts that name it. It was built to answer a question the widening created — a row
could appear for a reason the row did not show — and it answered it by swapping the slot's content.

## Goals / Non-Goals

**Goals**

- One meaning for the slot, at every keystroke.
- A Pane's Tab visible without having to guess its name first.

**Non-Goals**

- Widening what is searched. The same four facts match; only what is displayed changes.
- Showing the Pane's own name in the address. It is the row's label, two elements to the left.

## Decisions

### Show the address rather than the answer

Swapping the slot made it answer "what did you just match?", which is a question about the query
rather than about the Pane. The address answers "where is this Pane?", which is true before anything
is typed and stays true afterwards — and it happens to answer the first question too, because the
marks land inside it.

### Order and separators

`tab · space · host`, and a part that does not exist is left out rather than rendered blank. Tab
first because it is the part that distinguishes two Panes the operator is actually choosing between;
host last because a solo install has none, so the common form is exactly the two parts.

The row's box does not change: it is the same single truncating element it was, holding a longer
string.

### Offsets are the load-bearing part

A fuzzy match reports positions in the coordinates of the field it scored. Joining the parts into one
string means those positions have to be shifted by the lengths of the parts before it, separators
included, or the marks land on the wrong characters — silently, and in a way that looks like a
fuzzy-matching bug rather than an arithmetic one. That is what the per-part assertions in the tests
are for.

## Risks / Trade-offs

- **The address can be long.** It truncates, as it already did, and it is capped at 45% of the row.
  A Pane whose Tab and Space are both long shows less of the host — the part least likely to be what
  the operator is reading.

## Migration Plan

None. Display only.

## Open Questions

None.
