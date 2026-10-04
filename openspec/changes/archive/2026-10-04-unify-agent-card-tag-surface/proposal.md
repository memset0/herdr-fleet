## Why

Assigned tags currently sit outside the Agent row's painted surface, so a card, selected row or blocked row has a detached tag strip. The tags need their own line inside the same row surface with matching insets.

## What Changes

- Put the existing independent tag line inside the row's shared background, border and state treatment.
- Match its leading and trailing text insets and use compact bottom spacing, preserving all tag names and wrapping.
- Preserve independent navigation, favorite and tag actions, focus restoration, row type, heading ellipsis, body floors and ordering.
- Reuse the current fork-owned native row and tag presentation on Collie v1.15.0 (ef01b0ed4d9271897413984075aa6d2060ffcf2a).
- Non-goals: tag data/identity/editor changes, backend, shared Card primitive, sidebar spacing and concurrent integration work.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: apply the row surface treatment continuously to content and assigned tags.
- `fleet-pane-tags`: keep tags on a separate aligned line within the same row surface.

## Impact

Own native-agent-card.tsx, fleet-pane-tags.tsx, their existing native-agent-rail/fleet-pane-tags tests and this change directory. These paths are fork-owned; no new port. They were clean at start; other dirty paths belong to concurrent work. Browser-only PATCH with no data migration or peer deployment.
