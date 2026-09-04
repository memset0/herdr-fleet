## Context

See `proposal.md` — Why. The panel shell and the rename input already exist; this is a third surface
on the same shell, and the second one to move off the row-actions sheet.

## Decisions

### A typed answer, not a second Enter on a button

The operator asked for the terminal's own shape and it is the right one here: the question carries its
answer, the default is visible in the prompt's capitalisation, and confirming costs one keystroke
while declining costs any other. A dialog with a focused "Close" button confirms on Enter too, but it
does not SAY what pressing Enter will do, and it makes declining a deliberate act of aiming somewhere
else.

`y` is prefilled and selected. That is not a contradiction of "make the safe answer easy": the safe
answer is still what you get by typing literally anything, including a single character over the
selection. What the prefill buys is that the common case — you meant it — is Enter.

### Only `y` closes, and the check is explicit

The submission is compared against `y` case-insensitively after trimming, and everything else
declines. Not "not `n`", which would close on a typo; not a truthiness test, which would close on
anything non-empty. A close is the one place where an unrecognised answer must mean no.

### The pointer keeps its own confirmation

The row-actions surface still confirms in its own two-activation way, and this change does not touch
it. Two surfaces, two idioms, each suited to its input — and only one mutation path underneath, which
is what actually has to be shared.

## Risks / Trade-offs

- **A prefilled `y` makes confirming almost free** → that is the request, and the cost of the error it
  permits is bounded: one Tab, closed by an operator who pressed a close chord and then Enter. The
  alternative — an empty field — turns every deliberate close into two decisions and trains the
  operator to type `y` without reading.
- **A confirmation that outlived its target would close the wrong thing** → it closes on target or
  route change, and submits the id it opened with.

## Migration Plan

None. The commands keep their bindings and their effect; what asks first has changed.
