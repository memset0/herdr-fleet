## Why

The exact Collie v1.2.0 baseline already implements optional Web Push, safe VAPID key generation,
subscription management, and test delivery, but the downstream Herdr Fleet manifest dropped its
two no-argument Push actions when the Fleet-owned lifecycle replaced Collie's service lifecycle.
Restore those operational entrypoints without creating a second notification implementation.

## What Changes

- Add Herdr Fleet actions for generating Push keys and sending a test notification.
- Delegate both actions byte-for-byte to Collie's existing `scripts/collie-ctl.sh` and CLI verbs so
  config-directory resolution, mode-600 writes, overwrite refusal, subscription use, and
  diagnostics retain upstream behavior.
- Keep Fleet start/restart as the explicit step that reloads newly generated keys.
- Clarify that native Collie Web Push remains an optional inherited feature while Fleet-specific
  aggregate/external notifications remain deferred.
- Add focused manifest/lifecycle tests and update the existing manifest invasive boundary.

Non-goals:

- Automatically generating, rotating, enabling, testing, or committing real VAPID keys.
- Reimplementing Push, subscriptions, service workers, notification preferences, or delivery
  semantics under `fleet/`.
- Adding Herdr actions that require arguments or terminal review, including subscription
  list/forget.
- Discord, central collectors, multi-host notification routing, Pack, SSH, Gateway, STT, release,
  production cutover, deployment configuration, or any v2 change/removal.

## Capabilities

### New Capabilities

- `fleet-native-web-push-actions`: Thin Herdr action exposure of Collie's existing safe Push-key and
  test-delivery operations for the Fleet plugin profile.

### Modified Capabilities

None. Collie's Push implementation, subscription model, browser controls, and delivery behavior
remain upstream authority.

## Impact

- Extends `herdr-plugin.toml` with two existing Collie CLI entrypoints.
- Adds focused assertions to Fleet lifecycle/manifest tests and clarifies public Fleet docs.
- Updates `FORK.toml` and `CHANGELOG.md`.
- Adds no runtime module, dependency, secret, API, route, listener, or automatic live mutation.
