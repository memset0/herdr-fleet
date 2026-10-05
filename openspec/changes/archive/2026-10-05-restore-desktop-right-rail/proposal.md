## Why

The downstream rail alignment raised the right sidebar threshold from 80rem to 96rem, hiding Agents and Todoist at ordinary desktop widths. Restore their existing desktop access while retaining a usable native route column on the Collie v1.15.0 baseline.

## What Changes

- Show both fork-owned rails and their separators from 80rem.
- Remove the intermediate hierarchy-only width cap, retaining independent bounded widths.
- Preserve native route, drawer, pane switcher, stored widths, collapse command, and Todoist behavior; no new UI or upstream changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: restore a shared desktop threshold and document the available central width.

## Impact

Fork-owned navigation shell, its focused responsive test, and sidebar specification. The existing upstream Pane switcher port and its test follow the same threshold, with the existing FORK.toml port description updated. No API, dependency, configuration, or new upstream boundary.
