## Why

Fleet 4.0.0, based on exact Collie v1.28.0, gives children only ten seconds to initialize. A Core collector may first open native state and agent stores, so valid cold initialization can be mistaken for a failed generation.

## What Changes

- Share one bounded startup policy between the daemon, control caller and launch-lock recovery.
- Give Core-backed children a longer readiness window without slowing a child that becomes ready immediately.
- Keep the independent TUI profile's current readiness policy and preserve generation ownership and failed-start cleanup.
- Publish a minor release because every peer executes this lifecycle code; preserve the existing 4.0.0 tag.

Non-goals: changing the upstream Core adapter, message deadlines, trust, transport, configuration schema, terminal-runtime lifecycle or UI behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-plugin-runtime`: bounded Core cold-start readiness and caller/lock budgets that outlast it.

## Impact

Fork-owned lifecycle modules and focused synthetic startup coverage. No new upstream port or runtime dependency. Deployment-specific observations and bindings remain outside the public tree.
