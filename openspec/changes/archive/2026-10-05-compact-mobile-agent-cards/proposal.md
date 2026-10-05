## Why

Touch targets in the Agent card grow to 44px each but remain vertically stacked, forcing a 96px body and unusually large mobile whitespace. A mobile action row can keep usable targets without inflating the card.

## What Changes

- Below the phone breakpoint, place favorite and tag actions side by side in the trailing area while retaining desktop stacking.
- Keep phone targets at 44px and the body floor at 64px; reserve the action row's real width.
- Adapt tag insets and the spacing reclaim to the shorter body, preserving a continuous surface and independent clicks.
- Check long metadata, headings and tags for collisions on narrow phones.
- Reuse fork-owned presentation and native data behavior on Collie v1.15.0 (ef01b0ed4d9271897413984075aa6d2060ffcf2a).
- Non-goals: identity, pins, tag storage, sorting, Todoist, backend or upstream primitives.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-agent-favorites`: responsive action ordering with a horizontal phone pair.
- `fleet-pane-tags`: phone tag layout follows the compact action row.
- `fleet-native-navigation-sidebars`: compact phone bodies with independent touch targets.

## Impact

Own native-agent-card.tsx, fleet-pane-tags.tsx, their existing rail/tag tests, this change, affected canonical requirements at sync and this task's changelog entry. Existing unrelated active change and device operation remain outside scope. Frontend-only PATCH 3.9.0 to 3.9.1; focused validation and lead deployment.
