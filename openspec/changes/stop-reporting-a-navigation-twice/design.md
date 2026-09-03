## Context

See proposal.md — Why. Collie's `usePollBusy` already takes both thresholds as parameters; what it
has no way to express is "do not watch this signal at all".

## Goals / Non-Goals

**Goals:**

- Turn one signal off without touching the other, and without a number standing in for "never".

**Non-Goals:**

- Changing what the bar means, or when a write or a hung poll surfaces it.

## Decisions

### `null`, not a very large number

A threshold is a delay, and every delay eventually fires. `Infinity` is worse than a large number
rather than better: the timer APIs coerce it, and a caller reading it would have to know that. So the
parameter widens to `number | null`, the navigation signal is simply not watched when it is null, and
the hook's other half is untouched.

### One density for a list that is scanned

The hierarchy was touch-sized below the rails' breakpoint and compact above it. That made the phone's
copy a different surface from the desktop's — the same names, read twice as tall, half as many on a
screen. It is a tree of names scanned for one row, not a row of targets aimed at, and the surfaces
that ARE aimed at on a phone keep their floors.

## Risks / Trade-offs

- [A 28px row is a smaller target on a phone] → It is a list scanned with the eye and tapped once at
  the end, its rows span the full width of the surface, and every control that answers a thumb
  repeatedly keeps its own 44px floor.
- [A genuinely black-holed navigation now reports nothing] → The route it lands on reports its own
  loading, and a write or a hung poll still surfaces the bar.
