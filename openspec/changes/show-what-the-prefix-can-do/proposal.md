## Why

The prefix is now the way almost everything is reached, and it is the one part of the command system
an operator cannot see. `Ctrl+Shift+P` lists the catalog, but you have to already know that chord to
find out that `Ctrl+B` leads anywhere at all — and once you have pressed the prefix, the two seconds
before it expires are spent recalling a second chord from memory or giving up.

Every serious prefix keyboard answers this the same way, and the answer is not a manual: it shows the
next keys while it is waiting for one.

## What Changes

- While a prefix is pending, Fleet SHALL show a compact panel listing every second chord that
  currently leads somewhere, with the command each one runs.
- The list is generated from the **effective** bindings, so an operator who rebound or unbound a
  command sees their own keyboard rather than the shipped one, and a command bound to two prefix
  chords appears under both.
- Entries are grouped by what they act on and set in a small, dense type so a long list fits without
  scrolling, in several columns.
- The panel appears after a short pause rather than instantly, so a fast `Ctrl+B S` never flashes it
  and a hesitation always gets it. It leaves the moment the sequence completes, expires or cancels.
- It takes no focus, floats over the page, and holds no space — pressing the prefix must not move a
  single pixel of what is underneath.

### Non-goals

- A key that opens the panel on purpose. It is a hint about a pending state, not a reference; the
  command bar is already the reference, and `Prefix+?` already reaches it.
- Showing direct chords. They are not what the operator is being asked to complete.
- Making the panel interactive — no pointer targets, no selection, no scrolling. A row you could
  click would be a second, worse command bar.
- Changing the prefix timeout, the recognizer's matching, or any binding.

## Capabilities

### Modified Capabilities

- `fleet-keyboard-commands`: the pending-prefix state gains a visible affordance — what the panel
  lists, where it comes from, when it appears and when it leaves.

## Impact

- One new pure module under `fleet/ui/commands/` deriving the grouped hint rows from effective
  bindings, covered by the root suite, and one new fork-owned component rendering them.
- The command provider gains a delayed `armed` signal. No change to the recognizer, to the catalog,
  or to any upstream-owned path beyond the six typed dictionaries the panel's own labels land in.
