## Why

Panel widening appends merged cluster snapshots as though they were member-only responses. Duplicate rows carry different session metadata and distort native grouping, counts and time order. The previous tests used member-only synthetic responses and missed the actual API contract.

## What Changes

- Start dragging immediately from the six-dot handle; keep card body taps and native scrolling separate.
- Filter each widened response to its explicitly requested member before merging it with the lead snapshot.
- Collapse repeated observations of one scoped terminal placement while retaining distinct sessions and ambiguous terminal identities at different placements.
- Verify panel grouping, counts and time order against a synthetic merged multi-member response and inspect read-only live inventory evidence.
- Reuse the native rail and Collie v1.20.1 merged snapshot contract. No upstream API, peer protocol, slot persistence, or terminal-control changes.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `fleet-agent-panel`: unique Agent rows across merged and widened inventory responses.

## Impact

Owned panel inventory normalization and focused unit/browser regressions. Frontend-only patch release; members need no redeployment.
