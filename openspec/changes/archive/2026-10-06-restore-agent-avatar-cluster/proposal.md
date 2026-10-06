## Why

The rail currently spreads ordinal, state and agent artwork across the heading. Restore the earlier integrated avatar so identity reads as one unit. This is a fork-owned UI change on the Collie v1.15.0 baseline.

## What Changes

- Restore a 32px agent mark with shortcut ordinal at the lower-left and state dot at the lower-right.
- Place that cluster across the first two text lines on desktop and phones.
- Reserve a third footer line for wrapping tags and trailing right-aligned host/session metadata.
- Preserve current text sizes, whole-phrase ellipsis, time, tag editing, actions, ordering and accessible state descriptions.
- Non-goals: full historical card rollback, shortcut changes, upstream changes or Todoist changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: integrated avatar and three-line Agent row anatomy.
- `fleet-pane-tags`: tag/host footer sharing and natural wrapping.

## Impact

The owned native Agent card, tag footer and focused tests change. Native AgentIcon and StatusDot are reused. No new fork boundary or backend work; lead-only PATCH.
