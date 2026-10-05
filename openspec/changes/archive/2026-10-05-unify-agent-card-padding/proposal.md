## Why

The phone Agent cards should have the same compact spacing and vertical actions as the desktop Agent rail. Pointer-specific enlargement and the subsequent horizontal workaround introduce unwanted padding and layout differences.

## What Changes

- Keep favorite above tag in one compact trailing column on every viewport and pointer type.
- Use the desktop card's body height, edge insets and tag spacing consistently on phones.
- Retain shrinking metadata, combined heading ellipsis and independent action semantics.
- Baseline remains Collie v1.15.0; only fork-owned Agent cards change. Non-goals: upstream cards, tag editor controls, sorting, associations and backend behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-agent-favorites`: one compact vertical action column across devices.
- `fleet-pane-tags`: identical tag/action insets across devices.
- `fleet-native-navigation-sidebars`: consistent card padding and content minimum without pointer-dependent inflation.

## Impact

Two fork-owned React components and three capability specifications. Frontend-only patch; no dependencies or protocol changes.
