## Why

Tree nesting is hard to distinguish, and inline completion controls invite accidental status changes. This iteration improves the fork-owned Todoist UI on the Collie v1.15.0 baseline.

## What Changes

- Show compact tree connector guides instead of enlarged row padding.
- Show per-task project metadata only inside expanded details; retain project group headings.
- Remove row completion checkboxes; completing and reopening require opening task details first.
- Publish verified iterations while keeping this change active until the owner accepts the UI.
- Non-goals: provider behavior, hierarchy guards, ordering, binding and delivery changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-todoist`: clearer hierarchy and completion actions restricted to expanded details.

## Impact

Only the owned Todoist frontend and its focused tests change. Native buttons and Collapse are reused. No upstream ports, APIs or dependencies change; rollout is lead-only PATCH.
