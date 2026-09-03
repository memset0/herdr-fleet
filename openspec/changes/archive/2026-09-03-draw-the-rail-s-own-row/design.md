## Context

See proposal.md — Why. Collie's `AgentList` does two separable jobs: it ORDERS the herd (triage
sections, headings, favourite-first) and it DRAWS a row. Only the second is wrong for a rail.

## Goals / Non-Goals

**Goals:**

- Keep the ordering in Collie's hands, so a future change to triage reaches the rail for free.
- Leave `AgentList` and `AgentCard` untouched, so no other surface moves.

**Non-Goals:**

- A shared row that serves both the dashboard and the rail through a presentation prop.

## Decisions

### The rail takes the order and draws the row

The rail calls Collie's `triage` and `sectionHeaderProps`, renders Collie's `SectionHeader`, applies
the fork's existing favourite-first ordering inside each section, and then draws its own row. The
seam is exactly where the two jobs part.

Alternative considered: a fifth presentation prop on `AgentCard`. Rejected — the existing four
choose a density, a status style, a scope and an age; a fifth that reversed the ORDER of its two
lines would make one component two, wearing one name. Collie's rows keep their behavior and this one
is the fork's.

### The name on line one is the hierarchy's rule, lifted out

Both surfaces answer "what is this piece of work called", so the rule — the operator's own Pane name,
else the Tab's, never an ordinal the multiplexer assigned — moves to `fleet/ui/pane-naming.ts` and
both import it. Two copies of that rule is the drift this repository keeps warning about.

### The ordinal is numbered across the rail, not per section

A key the operator presses addresses a row on screen; it does not know which heading that row fell
under. Rows past the range one key can reach carry no badge at all, because a number that no key
answers is a promise.

### A leaf draws no disclosure column

The tree spent a chevron's width on every row so that labels at one depth lined up. Measured on a
280px rail that is a fifth of the row given to alignment nobody asked for, and it put an empty
column inside the highlight before the icon. Instead the guide line lands on the CENTRE of the
control that opened the level (`ml` = half a chevron) and the children begin half a chevron further
in, so a child's row starts exactly one chevron right of its parent's — the indentation the eye
reads, without the column.

## Risks / Trade-offs

- [A parent's label and a leaf's icon no longer start at the same x within a level] → That is the
  point: the leaf has no control, so it spends no column on one, and its own icon marks the level.
- [The rail's ordering now lives in two files rather than one] → Only the CALL does; the rules stay
  in `lib/triage.ts` and in the fork's favourite store, and the rail's tests pin the order it
  produces.
