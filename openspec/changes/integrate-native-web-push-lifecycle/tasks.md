## 1. Reconcile the inherited Push boundary

- [x] 1.1 Re-read the exact Collie v1.2.0 Push CLI, plugin actions, current Fleet manifest/lifecycle tests, source specs, `FORK.toml`, and this change; record the clean `v3-dev` baseline and exact task-owned paths.
- [x] 1.2 Confirm the Fleet action environment resolves the same plugin config/state directories consumed by Collie and verify no Fleet-owned Push implementation or wrapper is required.

## 2. Restore the native Push actions

- [x] 2.1 Add exactly one no-argument `push-keys` and one no-argument `push-test` action to `herdr-plugin.toml`, delegating to the frozen Collie shim/verbs; verify focused manifest tests reject duplicates, `--force`, embedded values, alternate scripts, and argument-bearing subscription actions.
- [x] 2.2 Extend the existing Fleet lifecycle manifest test to verify the two Push actions coexist with the Fleet-owned start/stop/restart/status/url actions without routing Push through `scripts/herdr-fleet.sh`.
- [x] 2.3 Update the existing `plugin-identity` invasive entry's intent/verification without adding a duplicate manifest entry; verify the fork checker accepts only the exact manifest port.
- [x] 2.4 Clarify the public Fleet guide and Changelog: native Collie Web Push is optional and inherited, key generation/restart/browser subscription remain explicit, and Fleet-specific aggregate/Discord notifications remain deferred.

## 3. Validate and publish the candidate

- [x] 3.1 Run the focused Fleet lifecycle/manifest tests plus Collie's existing Push key/program/CLI tests, affected typecheck/lint, version/fork checks, and strict OpenSpec validation without reading or mutating live VAPID keys/subscriptions.
- [x] 3.2 Run the full root and Web suites once at commit readiness with Bun 1.3.14, both typechecks, full-tree lint, production build, fork/version/OpenSpec checks, and exact staged diff review.
- [x] 3.3 Run the public-tree/scope audit and verify no VAPID value, subscription endpoint, private config, new Push implementation, Gateway/service-worker/UI change, Discord collector, Pack, SSH, ttyd, or STT change entered the candidate.
- [x] 3.4 Commit the complete action integration as one conventional commit on `v3-dev`, fetch/verify `origin/v3-dev`, push normally, and verify the exact remote commit remains public-safe and independently buildable.
- [ ] 3.5 Update only the isolated v3 staging checkout to that exact commit, re-link/restart v3 without invoking either Push action, and verify Herdr reports both actions while live VAPID/subscription/STT state and all v2 processes remain unchanged.

## 4. Reconcile and archive

- [ ] 4.1 Present the action ids, exact commands, candidate commit, source link, verification, unchanged-live-state evidence, and rollback for owner acceptance.
- [ ] 4.2 After acceptance, re-read the final implementation/artifacts, sync `fleet-native-web-push-actions` into canonical source specs, and archive the change through the generated workflow.
- [ ] 4.3 Commit/push only the canonical spec and archive paths in a separate OpenSpec commit, redeploy the new exact archive HEAD without invoking Push, and report all source/deployment identities.
