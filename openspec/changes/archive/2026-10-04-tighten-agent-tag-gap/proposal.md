## Why

The assigned-tag line sits too far below the Agent row's two text lines because its body reserves space for stacked controls. Reclaiming the unused lower band will make the tags read as part of the same compact card.

## What Changes

- Move the tag line upward within the blank text-side area of the existing body floor.
- Keep the shared surface, matching horizontal/bottom padding, full tag labels and independent actions.
- Synchronize the inset with tag expansion/collapse so untagged rows keep their normal height.
- Reuse the current fork-owned row and Collapse primitive on Collie v1.15.0 (ef01b0ed4d9271897413984075aa6d2060ffcf2a).
- Non-goals: text sizes, internal line spacing, button targets, ordering, tag data/editor, backend and concurrent feature development.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. Existing presentation requirements remain satisfied; skip_specs is enabled.

## Impact

Own fleet-pane-tags.tsx and this change directory, plus this task's selectively staged changelog entry. Other dirty paths and the existing concurrent changelog entry remain outside this task. Frontend-only PATCH.
