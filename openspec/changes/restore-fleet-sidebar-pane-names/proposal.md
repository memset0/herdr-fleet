## Why
Fleet 4.1.0 adopts Collie v1.28.0, whose Pane route adds a second large-screen sidebar inside Fleet's existing shell. Fleet also still favors tab names where the operator now expects filtered pane names.

## What Changes
- Keep Fleet's existing responsive hierarchy and Agent rails as its navigation surfaces, with a single Pane view inside them.
- Suppress the upstream large-screen layout setting in Fleet while retaining upstream behavior outside Fleet.
- Share filtered pane-name presentation across the Fleet hierarchy and Agent rail; preserve tab grouping, navigation and actions.

Non-goals: changing upstream standalone behavior, Core, message delivery, stored terminal names, or restoring Todoist.

## Capabilities
### New Capabilities
None.
### Modified Capabilities
- `fleet-native-navigation-sidebars`: single-shell ownership and pane-first filtered row names.

## Impact
Owned naming/shell modules and narrow existing Pane route port, plus a build-gated settings port. UI-only patch release; deploy the lead alone.
