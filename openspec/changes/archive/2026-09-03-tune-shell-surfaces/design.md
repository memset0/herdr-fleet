## Context

See proposal.md — Why. Both surfaces exist and keep their contracts; only two class strings change.

## Goals / Non-Goals

**Goals:**

- Fix the control row's alignment by construction rather than with a compensating offset.

**Non-Goals:**

- Re-opening where the state is drawn, or what the row's controls do.

## Decisions

### The line box does the alignment, not a nudge

`leading-none` gave the word a line box the height of its own type — 10px against the icon's 16px.
Both boxes were centred, which is why nothing looked broken in the markup and everything looked
wrong on screen: the glyphs sat high inside a box shorter than their neighbour. Dropping
`leading-none` and taking `text-xs` gives the word a 12px glyph in a 16px line box, which is exactly
the icon's height, so the two agree without a pixel of correction anywhere. The row then no longer
needs the 44px it was spending on a second line it stopped drawing.

Alternative considered: keep `leading-none` and nudge the word with padding. Rejected — it is a
number that has to be re-measured every time either side's type changes.

### The dot's size is the caller's to state

`StatusDot` merges the caller's classes over its own, so the tree asks for one size down at the call
site rather than the component learning a variant for one caller.

### A bare number is the counter answering, not a person

Herdr numbers the panes nobody named, so `"1"` arrives in the same field a chosen name would. Digits
only: a name that merely contains a number (`v2`, `pass 3`) is still a name. The one case this
cannot tell apart is an operator who deliberately names a pane `7`, who gets the Tab's name instead
— a legible name rather than an ordinal, which is the better failure of the two.

### The seam was the page, not a border

The separators were `bg-transparent` while the rails and the route column were both the page colour,
so there was nothing to see. With the rails and the header on the chrome ground the same 4px became
a dark strip down each side. They take the chrome ground too; the grab affordance is still the
hairline that appears inside them on hover or focus.

## Risks / Trade-offs

- [A 36px control row is under the 44px touch floor the row used to keep] → It is the operator's own
  measurement of a row they use with a thumb every day, and the row's hit area is still the full
  width of its fifth of the screen; the floor stays where it is on every other control.
- [An operator who names a pane `7` loses that name in the tree] → They keep it everywhere else, and
  the row shows the Tab's name instead of an ordinal, which is what the rule exists to prevent.
