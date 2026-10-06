## Why

The Agent footer should lead with its host and place the timestamp at the trailing edge, keeping tags between these facts. Adjust the owned card layout on the Collie v1.15.0 baseline.

## What Changes

- Move the existing age from line two to the footer's final right edge.
- Lead the footer with native host/session metadata followed by assigned tags.
- Preserve tag wrapping, avatar, controls, timestamp selection and formatting.
- Non-goals: sorting, tag mutation, upstream changes or Todoist work.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: footer timestamp and leading host placement.
- `fleet-pane-tags`: host-first wrapping tag footer with trailing time.

## Impact

Existing owned Agent card, tag footer and focused tests only. Frontend-only PATCH, with no new fork port or stored data migration.
