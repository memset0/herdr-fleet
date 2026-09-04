## Why

Two things the keyboard commands got wrong, both found by using them.

**Rename opens the wrong surface.** `Prefix+Shift+T` and `Prefix+Shift+P` currently open Collie's
action sheet — a bottom sheet, designed for a thumb, that arrives from the edge of a phone screen.
Reusing it was defensible on paper and is wrong in the hand: a rename started from the keyboard
should put a text field where the operator's eyes already are, which is where the command bar
appears, not at the far edge of the screen.

**`create-tab` creates a Tab and does not land in it.** It calls the create API directly and then
navigates, which skips the four things Collie's own create-and-jump flow does — most importantly
handing the fresh Pane to the route through navigation state. Without that the new Pane is not in the
snapshot yet, so the page it lands on reports an Agent that is gone.

## What Changes

- Rename commands SHALL open a Fleet-owned input in the command bar's own position and treatment,
  prefilled with the current name and selected, submitting on `Enter` and cancelling on `Escape`.
- The panel shell the command bar already draws becomes a shared component, so the two surfaces are
  the same panel by construction rather than by two sets of matching classes.
- `create-tab` SHALL delegate to Collie's existing create-and-jump flow instead of calling the API
  itself, which restores the write gate, the error message, the revalidate, and the fresh-Pane
  handoff.
- Space rename and close stay absent, and the specification records WHY in more detail than "the
  bridge has none": Herdr itself exposes `workspace.rename`, and what is missing is the whole chain
  between it and the browser — a capability flag, a verb on the multiplexer port, a bridge route and
  a client function, plus an answer from the tmux and zellij adapters. That is surgery on Collie's
  own multiplexer contract, not a presentation decision this fork gets to make.

### Non-goals

- Adding a Space rename or close command, or any of the four layers it would need.
- Adding a "new Pane in this Tab" command: Herdr's verified RPC surface has no split or pane-create
  at all, so the gap starts one layer below Collie.
- Changing Collie's action sheets. They keep their rows, their behavior and their callers; the
  keyboard simply stops being one of those callers for rename.
- Changing what rename means. Tab still requires a non-blank label; Pane still clears on blank.

## Capabilities

### Modified Capabilities

- `fleet-keyboard-commands`: rename opens the fork's own input at the command bar's position rather
  than Collie's sheet, `create-tab` delegates to the native create-and-jump flow, and the reason a
  Space has no rename or close is stated precisely.

## Impact

- One new fork-owned panel shell shared by the command bar and the rename input, and one new
  fork-owned dialog. `web/src/components/native-navigation-shell.tsx` swaps two adapters over.
- No new invasive path. `create-tab` now uses an existing Collie hook, which is less invasive than
  the direct API call it replaces.
