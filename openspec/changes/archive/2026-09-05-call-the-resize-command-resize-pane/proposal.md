## Why

The command that resizes a Pane is called `Fit Current Pane Width`, and the operator could not find
it in the palette. Not because it was missing — every catalog command is listed — but because the
word they searched for was `resize`, which appears nowhere in that name, in its id `fit-pane-width`,
or in its binding label. Command search matches those three strings and nothing else, so the query
returned nothing while the command sat three rows away.

The name is the fault. `Fit Current Pane Width` describes the mechanism — it fits the Pane to the
mirror's width — and an operator looking for it is thinking about the outcome. A palette is searched
in the operator's vocabulary, and the catalog's job is to be named in it.

## What Changes

- Rename the command's English name from `Fit Current Pane Width` to `Resize Pane`.

Non-goals, each deliberate:

- **The id `fit-pane-width` does not change.** It is the vocabulary of the settings document the
  operator hand-writes, and an unknown id is a WHOLE-document rejection — every binding in the file
  lost at once. That is a harsh failure to accept for a cosmetic alignment, and every deployment's
  own document would have to be checked first. Renaming it stays available as its own decision.
- **No behaviour changes.** Same scope, same `Prefix+R` default, same action.
- **No search keywords.** Matching a command on words that are not its name is a real idea and a
  larger one; it is not needed to fix a command that is simply named wrong.

## Capabilities

### Modified Capabilities

- `fleet-keyboard-commands`: the shipped catalog's English name for `fit-pane-width`.

## Impact

- Fork-owned: `fleet/ui/commands/catalog.ts`, and the acknowledgement text three tests assert.
- Upstream-owned: none.
- The name is displayed in the palette, in the settings reference and in the floating acknowledgement.
  It is not persisted anywhere and is not part of any wire or configuration contract, so nothing has
  to be migrated.
