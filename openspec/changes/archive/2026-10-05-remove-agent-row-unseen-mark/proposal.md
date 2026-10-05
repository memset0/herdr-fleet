## Why

Ready unseen rows display an extra filled marker after their heading. The operator requests removing this redundant mark from the Agent cards.

## What Changes

- Remove the per-row unseen mark and its reserved slot from the shared rail/switcher card.
- Keep native status, triage grouping, unseen counts and mark-all-seen behavior.
- Preserve upstream dashboard/header unseen marks on Collie v1.15.0 (ef01b0ed4d9271897413984075aa6d2060ffcf2a).
- Non-goals: seen receipts, timestamps, tags, ordering, other surfaces or backend changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: omit the additional unseen mark on Agent rows and describe unseen feedback through group/summary controls.

## Impact

Own native-agent-card.tsx, native-agent-rail.tsx's obsolete comment, native-agent-rail.test.tsx, this change, its canonical capability at sync and the task's changelog entry. All code paths are already fork-owned. Concurrent dirty work remains outside this task. Frontend-only PATCH 3.7.8 to 3.7.9; focused verification and lead deployment.
