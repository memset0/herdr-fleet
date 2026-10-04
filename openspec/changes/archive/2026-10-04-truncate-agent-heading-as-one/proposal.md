## Why

The Agent rail currently truncates the Space separately before the work name, making short Space names needlessly disappear. The heading should be read as one phrase with one trailing ellipsis.

## What Changes

- Treat `Space · Tab/Pane` as a single inline heading and truncate only the complete phrase at its trailing end.
- Preserve distinct muted Space and weighted work-name styling, fixed ordinal/status/Agent/unseen marks, and the existing action reserve.
- Reuse the fork-owned native row on Collie v1.15.0 (ef01b0ed4d9271897413984075aa6d2060ffcf2a).
- Non-goals: wrapping, separate name reserves, spacing, type sizes, ordering, tags, navigation and backend behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: truncate the complete Space/work-name phrase as one heading rather than abbreviating Space independently.

## Impact

Own native-agent-card.tsx, native-agent-rail.test.tsx and this change directory. Both code paths are fork-owned; no invasive port changes. Other dirty paths belong to concurrent work and are outside this task. Frontend-only PATCH; no peer deployment or data migration.
