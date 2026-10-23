## Why

The Fleet `push-test` action reports "no subscribed devices" even when a browser is subscribed. The
action runs Collie's CLI through the bootstrap shim with no `COLLIE_STATE_DIR`, and Collie ignores
`HERDR_PLUGIN_STATE_DIR`, so the CLI reads Collie's default state directory while the
Fleet-launched Collie keeps subscriptions under the plugin state directory's `collie/`. The existing
requirement already says both actions must resolve the same directories as that process.

## What Changes

Baseline: Collie v1.23.3 as recorded in `UPSTREAM.md`; Fleet 3.23.1.

- `push-keys` and `push-test` run through Fleet's own launcher, which states the Collie state
  directory exactly as the Fleet runtime derives it (`<plugin state dir>/collie`) and then delegates
  to Collie's unchanged bootstrap shim and native verb.
- The requirement that froze the shim as the manifest command is relaxed to the action ids and the
  delegation target; Herdr releases this deployment supports read the manifest's current actions.

Non-goals: no new Push action, no change to key generation, delivery, or subscription handling.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-web-push-actions`: the actions go through the Fleet launcher so they read the
  Fleet-launched Collie's state directory.

## Impact

- `herdr-plugin.toml` (already declared invasive): two action commands.
- `scripts/herdr-fleet.sh` (fork-owned): a `push-keys|push-test` branch.
- `fleet/lifecycle.test.ts` (fork-owned): manifest validator and a launcher assertion.
- Action scripts run on every member, but only a lead serves browsers; PATCH axis.
