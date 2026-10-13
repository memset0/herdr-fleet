## Why

Shared Pane selection waits for a polling cycle that includes slow multi-member inventory and heartbeat requests. Viewers should receive accepted choices immediately instead of waiting for unrelated work.

## What Changes

- Push accepted shared-view changes over authenticated server-sent events; keep existing POST commands and lead ordering.
- Send the current snapshot when connecting or reconnecting, close revoked/expired sessions and bound slow-consumer queues.
- Separate the push connection, Agent inventory refresh and participation heartbeat lifecycles. Hidden/left pages stop following; resumed pages reconnect before publishing navigation.
- Reuse Collie v1.20.1 native navigation and Fleet identity resolution. No peer protocol, terminal controls, new dependencies or durable state migration.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `fleet-selection-sync`: event-driven following with ordered reconnect and independent background refresh.

## Impact

Owned shared-state store, Gateway SSE route, browser client and lifecycle hooks, plus focused transport and latency tests. Lead-only patch: frontend rebuild and Gateway restart; peers need no redeployment.
