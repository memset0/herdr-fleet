## Context

See proposal.md — Why. Both defects are arithmetic that stopped being recomputed when an input moved.

## Goals / Non-Goals

**Goals:**

- Write the two positions as arithmetic over their inputs, at the line, so the next move of either
  input is caught by reading rather than by looking.

**Non-Goals:**

- Measuring anything at runtime. These are static offsets; a layout effect would be a heavier answer
  than the numbers deserve.

## Decisions

### The guide line's offset is stated as a sum

The row carries `px-1.5` and its chevron is `w-5`, so the chevron occupies 6..26px and its centre is
at 16px — `ml-4`. The children then begin one chevron-width in from where that chevron started
(6 + 20 = 26px), which past the line's own 1px is `pl-2`. Both numbers are written at the element
with their inputs named, because they have already moved once each and neither is a taste choice.

### The reserve belongs to the line that shares the corner

The favourite control is absolutely positioned at the row's top trailing corner, so exactly one line
has to clear it. Reserving on the button reserved on every line, which is why the age — the fact
specified to sit at the OTHER corner — never reached it.

## Risks / Trade-offs

- [A future change to the row's padding or the chevron's width silently breaks the line again] → The
  comment states both inputs and the sum, and the change that moves one is the change that reads it.
