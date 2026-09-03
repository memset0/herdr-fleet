## Context

See proposal.md — Why. The shell, the model and the preference store all exist and are fork-owned;
this change edits their rules, not their shape. Two facts constrain it:

- The bounded preference list holds identities of rows the operator has DISCLOSED. A row that is
  open until it is closed cannot be expressed in that list directly.
- The model receives Pane labels already reduced by Collie's own display chain, which prefers the
  operator's Pane name and falls back to a session name, a terminal title, and finally the Agent's
  own name. Only the first of those is a name the operator chose.

## Goals / Non-Goals

**Goals:**

- Keep every rule in the pure model and the pure preference store, so each is decided once and
  tested there.
- Add no second kind of preference and no second storage key.

**Non-Goals:**

- Multi-Host data. The Host row is still derived from the snapshot being viewed.

## Decisions

### A default-open Host is stored as a COLLAPSED marker, not as an inverted flag

The Host row's disclosure identity means "this Host is collapsed". Its presence in the same bounded
list conceals the Host; its absence discloses it. Nothing about the store changes — one list, one
toggle, the same bounds — and the row reads `open = !disclosed.has(id)` where every other row reads
`open = disclosed.has(id)`, which the row model states as a flag on the row itself.

The Host is therefore deliberately absent from a selection's ancestor list. Auto-disclosure exists to
reveal the selected Pane; forcing a Host open would undo an explicit choice the operator made about
a whole machine, and "I collapsed that machine" is a decision a deep link should not overrule.

Alternative considered: seed the Host's id into the disclosed list on first mount. Rejected: the
operator's collapse would be undone on the next load, which is the failure that makes a default-open
row hard, not the storage.

### The elided row is named by the operator, and the model is told which name that is

`NavigationPaneInput` carries the display label it already carried plus the name the operator
actually chose, when there is one. An elided row takes the chosen Pane name, then the Tab's name; a
Pane inside a surviving Tab keeps the display label, because there the terminal title is what tells
two sibling Panes apart. The rule lives in the model, so the component still only renders rows.

Alternative considered: keep using the display label and let the Tab's name win only when the label
equals the Agent's name. Rejected: it guesses. A terminal title is a name the terminal supplied, and
the model can be told that directly rather than inferring it from a string comparison.

### A row that can disclose, discloses

Activation is decided by the row's own shape: children mean disclose, no children mean whatever
target the row carries. That keeps the Space route reachable from the one Space row that cannot
disclose anything, and it removes the surprise of a control that discloses on its left half and
navigates away on its right.

## Risks / Trade-offs

- [A Space route is now unreachable from the tree whenever the Space has children] → It remains
  reachable from every existing native surface; the tree's job is reaching a Pane, and the row's
  disclosure control is what its shape promises.
- [Naming an elided row by its Tab hides a Pane's terminal title] → The title is still the Pane
  page's own heading, and inside a surviving Tab the Panes keep it; what it stops doing is standing
  in for a name on a row whose siblings all show the same value.
