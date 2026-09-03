## 1. Establish and publish the authority boundary

- [x] 1.1 Re-read source instructions, canonical Fleet specs, active changes, `PACK_PROTOCOL.md`, native Pack trust/mode code, Fleet config/lifecycle code, and `FORK.toml`; verify clean `v3-dev` equals `origin/v3-dev`, record exact task-owned paths, and confirm no Pack wire or parent/v2 path is owned.
- [x] 1.2 Strictly validate the complete proposal/spec/design/tasks set, audit it for public safety and exact Collie v1.2.0 scope, then commit/push only `openspec/changes/adopt-native-pack-authority/**` as a separate planning commit with the required co-author trailer.

## 2. Add strict backward-compatible role configuration

- [ ] 2.1 Refactor Fleet configuration into explicit schema-1 Lead, schema-2 Lead, and schema-2 Peer branches; verify focused tests pin the unchanged schema-1 normalized object and accept only the exact schema-2 lifecycle literals and role-appropriate tables.
- [ ] 2.2 Reject role-incompatible, unknown, transport, SSH, endpoint, key, command, membership, credential, and trust-material fields with qualified safe diagnostics; verify focused tests cover Lead/Peer omissions, distinct loopback endpoints, and secret-free errors.
- [ ] 2.3 Update synthetic public configuration documentation for both schema branches without adding a live config or transport field; verify the examples parse and the privacy scan finds no deployment fact.

## 3. Validate Collie's native Pack authority without mutation

- [ ] 3.1 Add one owned read-only Pack authority module that uses Collie's existing trust reader plus enrollment/mode derivation; verify focused tests accept matching Lead/Peer state and reject missing, invalid, solo, conflicted, and mismatched state.
- [ ] 3.2 Prove schema-2 authority validation runs before child construction and never calls a trust writer or changes trust-store bytes; verify focused filesystem/injected-seam tests cover both successful and failed validation.
- [ ] 3.3 Verify no enrollment, invitation, join/remove/leave/rotate, Pack secret grace, alternate roster, Pack wire, router, loader, UI, Host aggregation, remote write, update, deputy, or transport logic entered Fleet-owned modules.

## 4. Make child lifecycle and browser boundaries role-aware

- [ ] 4.1 Make Collie child environment construction role-aware: every role stays loopback with Tailscale publication disabled, Lead retains normal Gateway-facing origin values, Peer receives no public browser values, and neither receives Fleet credential/session or Pack trust material; verify focused environment tests.
- [ ] 4.2 Compose `collie + gateway` for schema-1/schema-2 Lead and `collie` only for schema-2 Peer; verify child order, isolated state, no Peer session-store/Gateway listener, bounded restart cleanup, and unchanged schema-1 child inputs.
- [ ] 4.3 Make readiness and control status role-aware while keeping schema-1 control JSON/text byte-compatible; verify focused protocol/lifecycle tests report schema-2 role and exact children without secrets.
- [ ] 4.4 Extend Gateway tests so both unauthenticated and authenticated `/pack/v1/*` requests remain public 404s with zero Collie calls while authenticated normal native `/api/*` requests retain existing behavior.

## 5. Reconcile the fork and source artifacts

- [ ] 5.1 Extend the existing `fleet-runtime` contracts and focused verification in `FORK.toml` without a redundant owned block or invasive path; verify the fork checker accepts only owned `fleet/**`, docs, Changelog, and OpenSpec edits.
- [ ] 5.2 Add one concise `CHANGELOG.md` entry and reconcile proposal/spec/design/tasks with implementation reality; verify `PACK_PROTOCOL.md`, `bridge/pack/**`, native router/loaders/Pack UI, and every excluded product family remain unchanged.
- [ ] 5.3 Run focused config/authority/environment/lifecycle/protocol/Gateway tests plus affected typecheck, lint, fork, version, OpenSpec, and privacy checks during implementation; resolve failures without weakening strict role or trust boundaries.

## 6. Validate, publish, stage, and archive

- [ ] 6.1 At commit readiness run the full root and Web suites exactly once with Bun 1.3.14, both typechecks, full-tree lint, production build, version/fork checks, strict OpenSpec validation, privacy/scope audit, and exact staged-diff review; record test counts and do not rerun passing full suites.
- [ ] 6.2 Commit the complete feature as one conventional commit with the required co-author trailer, fetch/verify `origin/v3-dev`, push normally with `SKIP_TESTS=1` only after the final suite passes, and verify the remote exact commit.
- [ ] 6.3 Deploy only the exact pushed candidate to existing isolated Lead staging with its unchanged schema-1 configuration, pinned Bun 1.3.14, and the existing controller; re-link/restart only `memset0.herdr-fleet`, verify readiness/schema-1 compatibility and unchanged trust/config/STT/Push/v2/Herdr state, then update deployment state.
- [ ] 6.4 If source verification and non-mutating schema-1 staging checks are complete without a real Peer or Pack-state action, sync all three capability deltas, archive automatically, commit/push the archive separately, and redeploy the exact archive HEAD; otherwise leave the clean pushed change active and record the precise external gate.
