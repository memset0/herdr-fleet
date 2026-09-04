## Context

See `proposal.md` — Why. `FleetPanel` already exists and both dialogs already use it; what is
duplicated is everything between the panel and the caller's own action.

## Decisions

### The split is "what happens", not "what it looks like"

The panel takes a heading, a detail, an initial value, a hint and an optional error, and answers with
the submitted string. Everything above that line is presentation and is now written once; everything
below it — whether a blank clears a label, whether an answer has to be `y` — stays with the caller,
because those are genuinely different and pretending otherwise would produce a component with a mode
flag for each.

### The initial value is an initial value

The panel takes it once and never watches it, and the callers mount one panel per target with a
`key`. That is what stops a poll landing a fresh label on top of a half-typed name, and it is the
same rule the rename input already discovered; making it the shared component's rule means the next
caller gets it without having to learn it.

### `y/N` is part of the question

In front of the field it reads as a prefix of what you are typing, and an operator who selects-all
and types has to reason about whether it will be replaced. In the heading it reads as what it is: the
question's own notation, saying which answer Enter will give.

## Risks / Trade-offs

- **One component serving two callers can grow a flag per caller** → the seam is the submitted string
  and nothing else; a caller that needs more than a heading, a detail, a hint and an error is a
  caller that should not be using this panel.

## Migration Plan

None. Both surfaces keep their behaviour; one of them moves a label.
