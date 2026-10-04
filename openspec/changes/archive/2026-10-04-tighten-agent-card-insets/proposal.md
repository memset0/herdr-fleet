## Why

The compact Agent rail is readable, but the space between each row's edge and its content remains too generous. Tighten that perimeter while retaining the accepted spacing within the content.

## What Changes

- Reduce row edge insets and its minimum content height, keeping the two text lines' gap and type unchanged.
- Move the stacked actions closer to the top and trailing edge while retaining independent coarse-pointer targets.
- Align assigned tags with the tighter text inset.
- Reuse the current fork-owned rail, native metadata, pins and tag editor on Collie v1.15.0 (ef01b0ed4d9271897413984075aa6d2060ffcf2a).
- Non-goals: section/card gaps, sidebar outer spacing, ordering, type sizes, routing, tag editor, backend and dependencies.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This presentation refinement continues to satisfy the existing row and tag requirements; `skip_specs: true` avoids duplicating concrete spacing values as new requirements.

## Impact

Own native-agent-card.tsx, native-agent-rail.test.tsx, fleet-pane-tags.tsx and its test, this change directory, and one CHANGELOG.md entry. All implementation paths are fork-owned; no invasive port changes. The tree was clean at task start. Frontend-only PATCH from 3.7.4 to 3.7.5; deployment on the lead suffices.
