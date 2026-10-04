## Why

Collie v1.15.0 (`ef01b0ed4d9271897413984075aa6d2060ffcf2a`) preserves bridge placement order inside triage buckets. Fleet's Agent roster should instead put the most recent seen or active work first inside the relevant groups, with the same order used for navigation.

## What Changes

- Sort Recent by descending `lastSeenAt` and Ready/Working by descending `lastActiveAt` in the fork-owned roster.
- Preserve group order, native Pinned order, Needs input order, and pin deduplication.
- Preserve input order for tied timestamps and put missing timestamps last.
- Reuse Collie's bucket classifier and pin store unchanged. Non-goals: dashboard order, backend timestamps, new preferences, and visual row changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: own time ordering inside Agent roster groups while keeping Collie's classification and native pin order.

## Impact

Only fork-owned roster derivation and its web adapter/tests change. The rail, command bar snapshot, next/previous and numbered selection keep consuming one roster. No wire contract, dependency, or upstream-owned file changes. This is a patch-axis frontend change; only the lead bundle needs deployment.
