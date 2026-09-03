## Context

See proposal.md — Why. The resize already carries a `{cols, rows}` pair to the controller; the rows
half is simply read off the pane rather than asked for. The client sends `{cols}` and the parser
refuses any other field.

## Goals / Non-Goals

**Goals:**

- One request per decision, whichever control makes it.
- An empty field that means something, rather than a zero standing in for "unset".

**Non-Goals:**

- Measuring rows. There is nothing on screen to measure them from: the mirror's height is the
  phone's, not the terminal's.

## Decisions

### Absence, not zero

`rows` is omitted from the request body rather than sent as `null`, and the parser reads a missing
field as "keep the Pane's own height" — which is the behavior every fit had before this existed. A
sentinel number would have to be excluded from the valid range and then remembered by everyone who
reads it.

### The settle is in the component, the bounds are in the module

`fleet/ui/manual-pane-fit.ts` owns what a valid row count is, what an empty field means, and where
the choice is stored; the component owns only the delay. That keeps the rule testable without a DOM
and the delay adjustable without touching the rule.

The delay is a prop with a default so a test can wait it out for real rather than faking the clock
React's own scheduler runs on — every attempt at the latter deadlocked the render.

### The picker's bounds are tighter than the wire's

The controller accepts what a pty accepts, which is four digits of rows. The FIELD accepts 4 to 200:
below four the mirror shows less than a prompt and its own wrap, and past two hundred the operator is
asking for a scrollback rather than a viewport. The wire's own validation is unchanged, so a value
the field refuses is still refused for the same reason it always was if it arrives another way.

## Risks / Trade-offs

- [A typed height can be wrong for the terminal underneath] → It is the operator's own number, the
  same one they would pass to `stty`, and the controller refuses what a pty refuses.
- [Two controls where there was one] → They answer two different questions, and only one of them has
  an answer that can be measured.
