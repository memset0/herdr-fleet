## Why

The expanded Pane strip band's transparent bottom padding exposes the page ground as a dark bar and makes its vertical insets asymmetric. This temporary downstream fix targets Collie v1.15.0's Pane layout.

## What Changes

- Paint the expanded strip band with chrome ground and balance its top/bottom insets.
- Preserve tab/pane scrolling, touch reach, selection, folding and terminal geometry behavior.
- Non-goals: upstream redesign, tab styling changes or global chrome changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: continuous background for the native Pane's expanded strip band.

## Impact

One narrow CSS-variable port on the upstream Pane band and values supplied by the owned shell. Update the existing FORK.toml entry and focused verification. Frontend-only PATCH.
