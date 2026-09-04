## Why

Closing from the keyboard drops the operator into the row-actions surface — the same thumb-shaped
sheet the rename commands were moved off, for the same reason. A close begun with a key should be
finished with a key.

It should not be finished with ONE key, though. Closing a Tab kills every Pane in it, and a command
that fires the moment a chord lands is a command a mistyped sequence can spend. The answer the
operator asked for is the one a terminal has used for decades: a question with a default, answered by
pressing Enter again.

## What Changes

- `close-tab` and `close-pane` open a confirmation on the command bar's own panel: a line saying what
  will be closed and what that costs, and an input already holding `y`.
- Enter with `y` closes. Anything else — `n`, a typo, an empty field — does not, and neither does
  `Escape`, dismissal, or the target changing underneath.
- The prompt reads `y/N`, so what the capital letter means is visible: the safe answer is the one you
  get by typing anything at all.
- Every close command in the catalog is checked, not only the one that was reported. There are two.

### Non-goals

- Changing what a close does, which endpoint it calls, or its read-only refusal. Only what asks.
- A second confirmation anywhere. The row-actions surface keeps its own two-activation confirm for
  the pointer; this replaces nothing there.
- A general confirm framework. Two commands share one dialog; a third can join when it exists.

## Capabilities

### Modified Capabilities

- `fleet-keyboard-commands`: the close commands confirm on the keyboard surface rather than opening
  the pointer's, and the confirmation's default is stated.

## Impact

- One fork-owned confirm dialog on the existing panel shell, and two adapters in the navigation shell
  pointed at it instead of at the row-actions state.
- No change to the close endpoints, the catalog, the recognizer, or any upstream-owned path.
