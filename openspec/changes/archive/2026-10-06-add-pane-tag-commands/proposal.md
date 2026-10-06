## Why

Tag actions are absent from the closed command catalog, so operators cannot discover them in the command bar or configure shortcuts. This completes keyboard access to fork-owned tag editors on the Collie v1.15.0 baseline.

## What Changes

- Add unbound `edit-pane-tags` / Edit Pane Tags and `manage-pane-tags` / Manage Tags commands.
- Open the existing assignment editor for the exact current pane, or the global definition editor without a selected pane.
- Reuse shared dispatch, focus containment, shortcut configuration and mutation guards.
- Non-goals: new tag storage, direct mutation commands, default shortcut allocation, or Todoist changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-keyboard-commands`: add two stable, configurable tag commands to the closed catalog.
- `fleet-pane-tags`: expose existing assignment and global editing through command and shortcut entrypoints.

## Impact

Only owned catalog, tag UI, shell wiring, command acknowledgement, documentation and focused tests change. No upstream ports or peer runtime changes; lead-only PATCH deployment.
