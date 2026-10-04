## Why

The Agent rail's large text and side-by-side actions squeeze useful names into a narrow column. The operator requests smaller type, more breathing room, a fixed vertical action column, and no prompt-cache temperature in this list.

## What Changes

- Reduce rail row type by one step and increase vertical content spacing.
- Reserve one compact trailing action column with favorite above tag editing; preserve independent activation and focus after pinning.
- Reduce assigned-tag badges in the rail while retaining every readable name and wrapping.
- Omit cache-temperature information from rail rows, retaining native host/session metadata.
- Reuse existing native rows, pins, tag editor, triage and metadata on Collie v1.15.0 (ef01b0ed4d9271897413984075aa6d2060ffcf2a).
- Non-goals: dashboard layout, tag persistence/editor design, routing, grouping, backend, peer changes or new dependencies.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: roomier smaller-type rows and metadata without cache readings.
- `fleet-agent-favorites`: compact rail star in a fixed trailing vertical column, with focus retained.
- `fleet-pane-tags`: compact rail badges and the tag action below the star.

## Impact

Own this change directory, native-agent-card.tsx, native-agent-rail.tsx and its test, fleet-pane-tags.tsx and its existing test, the relevant canonical specs at archive, and the changelog entry. These components are fork-owned; no new invasive path is planned. Product and parent trees were clean at start. Frontend-only PATCH; lead deployment suffices.
