## Why

Renaming exists twice. The keyboard opens a panel at the command bar's position; the row-actions menu
opens a centred modal of its own — and behind them sit two copies of the same save: the same two
endpoints, the same blank-value rules, the same status lines, the same error handling, written
separately.

That is one rename too many. It is also one prompt surface too many: the fork now has a top-anchored
panel and a centred dialog that ask the same question in two shapes, and an operator who renames a
Tab with the mouse and then with a key sees two different things happen.

## What Changes

- The row-actions menu opens the same rename the keyboard opens. Not the same input component — the
  same rename, with its one save, its one set of rules and its one set of messages.
- The centred prompt dialog is removed. It has no other caller, and leaving it standing would be a
  third spelling of the question waiting for someone to reach for it.
- The duplicated save in the row-actions surface goes with it.

### Non-goals

- Changing what a rename does, which endpoint it calls, or what a blank value means for each target.
- Changing anything else in the row-actions menu. Closing, focusing and the capability gates that
  hide rows the multiplexer cannot back all stay exactly as they are.
- Moving the shared panel into `components/ui/`; that directory is Collie's.

## Capabilities

### Modified Capabilities

- `fleet-keyboard-commands`: renaming is one surface with one save, reached from the keyboard and
  from the pointer alike.

## Impact

- `web/src/components/fleet-row-actions.tsx` loses two save functions and its own dialog import.
- `web/src/components/fleet-prompt-dialog.tsx` is deleted, with its `FORK.toml` entry.
- No change to the endpoints, the catalog, the recognizer, or any upstream-owned path.
