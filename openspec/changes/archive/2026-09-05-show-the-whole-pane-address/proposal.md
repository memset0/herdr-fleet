## Why

A Pane row's right-hand slot changes meaning as the operator types. It shows the Space; when the
query matches the Tab or the host it shows that instead. The intent was to answer "why is this row
here?", and the cost is that the one place a row says where it lives says a different thing from one
keystroke to the next — and that a Pane's Tab is invisible until a query happens to name it.

Showing the whole address answers the same question by never having hidden anything.

## What Changes

- The slot is the Pane's address, always: `tab · space`, with `· host` appended where there is one.
  A part the Pane does not carry is absent rather than blank.
- The matched characters are marked wherever in that address they fall, so a query still says which
  part of the address it hit.
- A match on the Pane's own name marks the name, as it already did, and leaves the address plain.

Non-goals: the row's layout, width and height are unchanged — it is the same single element holding
a longer string, truncated as it already was. Nothing new is searched.

## Capabilities

### Modified Capabilities

- `fleet-command-bar`: what a Pane row shows beside its name, and how a match is marked in it.

## Impact

- Fork-owned: `web/src/components/fleet-command-bar.tsx`.
- Upstream-owned: none.
