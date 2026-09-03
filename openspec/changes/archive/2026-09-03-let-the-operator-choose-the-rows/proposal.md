## Why

Fitting a pane on the exact Collie `v1.2.0` baseline changes its width and nothing else: the
columns are measured from the mirror, and the rows are read off the pane and written straight back.
That is right for columns — how many cells fit across the mirror is a fact about the viewport, and
asking an operator to count pixels would be absurd — but it leaves the one dimension that is a
JUDGEMENT unreachable. How much of a terminal to keep on screen, against a keyboard that takes half
the phone, is a choice, and the pane's current height is not an answer to it.

## What Changes

- The Display Settings fit surface becomes two controls: the existing action, which still measures
  the columns, and a field for the rows.
- A row count typed into that field is applied when it holds still and only when it changed, so one
  request lands per decision rather than one per keystroke. Both controls then send the same pair:
  measured columns, chosen rows.
- An empty field is a real value — leave the pane's own height — which is exactly what fitting did
  before the field existed, and what an operator who never touches it keeps getting.
- The choice is remembered per device as a bounded browser-local preference, so the auto action
  applies it too.
- The protected resize accepts an optional row count beside its columns, validated by the same rule
  the controller already applies, and keeps reading the pane's own height when none is supplied.

Non-goals:

- Measuring rows, deriving them from the viewport, resizing from a render or an effect, or changing
  the controller lease, the audit record's shape, or any write, session or capability gate.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-manual-pane-fit`: the fit surface gains a row field, and the protected resize accepts an
  explicit height.

## Impact

- Fork-owned: the fit module gains the row bounds, the parser and the preference; a new component
  draws both controls.
- Invasive: the resize body's parser and the client's call gain one optional field; the Pane page
  hands the two controls one callback.
- No dependency, route, backend state, or configuration change.
