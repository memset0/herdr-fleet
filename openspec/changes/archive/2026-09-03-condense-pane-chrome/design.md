## Context

See proposal.md — Why. Every surface here already exists; what changes is where each thing is drawn
and which of the two places says it. Three facts constrain the approach:

- The strip row's fold control is already pinned to that row's trailing end through an existing
  `trailing` slot, and the row is 44px whether anything is pinned there or not.
- The Pane page's composer receives its status as a prop and renders it in a band inside its dock.
  The band is also where a pack names the machine being written to.
- The header's shape is a claim of primitives a route makes; the shell draws the row.

## Goals / Non-Goals

**Goals:**

- Say the pane's state in exactly one place at a time, with no state in which it is said nowhere.
- Keep every port a value or a slot, and add no new mechanism to the header's claim beyond one more
  primitive.

**Non-Goals:**

- Re-ranking or re-ordering the controls beyond their layout, and any change to what they open.

## Decisions

### The badge goes in the slot the fold control already occupies

The strip row's `trailing` slot takes a node, so the badge and the chevron become one cluster at the
row's end with no new layout and no new height. The badge is Collie's own `StatusBadge` — colour and
word together, which is the pair the operator asked for and the pair a colour-vision simulation
needs.

Alternative considered: a slot on the folded summary bar as well, so the word survives folding.
Rejected in favour of handing it back to the composer: the summary bar is 32px of beads whose whole
purpose is being short, and the composer's band already knows how to say the word.

### The composer keeps the word and learns when to stand down

One boolean prop, defaulting to showing the word, so Collie's own behavior is unchanged wherever the
component is mounted alone. The Pane page computes it from facts it already holds — are there
strips, are they folded, is zen on — and the band leaves entirely through `Collapse` when it would
have neither the word nor a host chip, which is the 16px the operator was pointing at.

The dock gains a name (`data-slot="composer-dock"`) because callers had been finding it as "the
status band's parent", and the band now sits inside a presence wrapper.

### The mark becomes the fifth primitive in the header's claim

`override` already lets a route take the whole row, but the pane does not want the whole row — it
wants the row minus one fixture. A fifth boolean is the smallest thing that says so, it defaults to
drawing the mark, and the claim's equality check keeps a route that re-renders from re-rendering the
shell.

### The mark's knockout follows the fill instead of naming it

Moving the header to the chrome ground breaks the mark's near-side beads, which are cut out in the
header's own colour. Rather than leave that coupling implicit in two files, the mark takes the value
as a prop defaulting to the page colour, and the header passes its own fill. The existing test that
fails when the two disagree keeps doing exactly that.

### Automatic disclosure is keyed on the Pane, not on the tree

The effect ran on the derived tree's identity, which changes on every snapshot that moves any field.
Keyed on the selected Pane's id in a ref, it fires on arrival and never again, which is the whole of
what it was for.

## Risks / Trade-offs

- [The state's word is in two possible places, so a reader has to know which] → Exactly one is drawn
  at a time and the rule is a single derived boolean; the spec names all three cases that hand it
  back.
- [Five labelled controls in one row are tighter than four labelled plus one icon] → Every label
  already truncates inside its own box, and the row's height and touch targets are unchanged.
- [A route that declines the mark loses the tap that returns home] → The pane's own back affordance
  is unchanged, and no other route declines it.
