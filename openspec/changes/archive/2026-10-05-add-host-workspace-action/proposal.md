## Why

Host rows currently have no context actions, so right-clicking a machine cannot start a workspace there. Operators need a direct creation entrypoint addressed to the selected machine.

## What Changes

- Offer New workspace from a Host row's pointer menu and touch actions sheet.
- Reuse the existing new-space form and creation flow with the selected Host fixed; no ambient host/session inheritance or fallback to another machine.
- Preserve pairing, device, host-health and target-multiplexer capability refusals.
- Collie baseline remains v1.15.0. The host entrypoint is fork-owned; the existing creation API/form/flow are reused. Non-goals: renaming Hosts/Spaces, new backend contracts, deleting workspaces, or changing other row actions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: Host rows expose host-scoped workspace creation instead of no actions.

## Impact

Owned navigation model, shell and row-actions components; a narrow optional fixed-host port in the existing new-space form, declared in FORK.toml. Frontend-only patch, no new API or dependency.
