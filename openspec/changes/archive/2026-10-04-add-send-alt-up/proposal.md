## Why

The command bar offers fixed terminal keys such as Send Enter but lacks Alt+Up. Operators need the same bounded action for that chord without opening the key drawer.

## What Changes

- Add the unbound Pane command `send-alt-up`, named `Send Alt+Up`.
- Reuse the existing guarded fixed-key writer with the constant `alt+Up` chord.
- Preserve Collie v1.15.0 (commit `ef01b0ed4d9271897413984075aa6d2060ffcf2a`) behavior outside this downstream addition.
- Non-goals: default bindings, arbitrary key payloads, backend or crew-wire changes, new translation entries, key-drawer changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-keyboard-commands`: add the stable fixed-key command to the catalog and its guarded Pane adapter.

## Impact

Fork-owned command catalog and tests; one existing registration line in the upstream-owned Pane page and its boundary inventory. Existing key transport supports the chord. Release axis is PATCH because only the browser bundle changes.
