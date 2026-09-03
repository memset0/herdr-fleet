## 1. Establish and publish the reachability boundary

- [x] 1.1 Re-read source instructions, `PACK_PROTOCOL.md` §8.2 and ADR 0013/0016, the canonical `fleet-pack-authority`, `fleet-runtime-configuration` and `fleet-plugin-runtime` specs, every other active change, and `FORK.toml`; verify clean `v3-dev` equals `origin/v3-dev`, record the exact task-owned paths, and confirm no Pack wire, `bridge/**`, `web/**` or v2 path is owned.
- [x] 1.2 Strictly validate the complete proposal/spec/design/tasks set, audit it for public safety and exact Collie v1.2.0 scope, then commit and push only `openspec/changes/add-bidirectional-ssh-pack-reachability/**` as a separate planning commit with the required trailers.

## 2. Add the strict transport and reachability configuration

- [x] 2.1 Add the schema-2 Peer `[transport]` table with exact-key validation for the single link mode literal, the Lead SSH endpoint/account, owner-only identity and pinned `known_hosts` paths, both projection binds, the Lead Collie endpoint behind the local projection, and the bounded retry ceiling; verify focused tests pin loopback-only binds and reject wildcard, any-address, empty and non-loopback values.
- [x] 2.2 Add the schema-2 Lead optional `[[reachability]]` list of member id plus one loopback endpoint, reject `[transport]` on a Lead and `[[reachability]]` on a Peer, and reject every certificate, fingerprint, secret, key, password, command, membership and unknown field with a qualified secret-free diagnostic; verify focused tests cover both roles.
- [x] 2.3 Verify the Peer's own projected endpoint is derived from its validated `[collie]` table and is never restated in `[transport]`, and that schema 1 and a schema-2 Lead without a reachability list keep their exact normalized objects; verify focused backward-compatibility tests.

## 3. Add the owned reachability runtime

- [x] 3.1 Add one owned reachability module that builds the SSH argument set from validated configuration: both projections and nothing else, no shell, no pseudo-terminal, no agent or X11 forwarding, no multiplexing, no inherited user configuration, strict host-key checking against the configured `known_hosts`, identity only from the configured file, keepalives, and `ExitOnForwardFailure`; verify focused tests pin the exact argument set and the absence of every excluded option.
- [x] 3.2 Add the owner-only permission check for the identity and `known_hosts` paths and the loopback-only projection probe, both behind injectable seams; verify focused tests cover a too-permissive file, a missing file, a successful probe and a refused probe without touching a network.
- [x] 3.3 Give the link child the supervisor's existing generation-owned bounded exponential backoff with the configured ceiling rather than a second retry mechanism; verify focused tests pin monotonic growth, the cap, and that no unbounded immediate retry loop is possible.
- [x] 3.4 Verify no enrollment, invite, join, leave, remove, rotate, promote, trust write, Pack wire, router, loader, UI, Host aggregation, remote read/write, update, deputy or second link mode entered any Fleet-owned module.

## 4. Make the runtime and validation reachability-aware

- [x] 4.1 Compose `collie + link` for a schema-2 Peer while schema-1 and schema-2 Leads keep `collie + gateway` unchanged; verify focused tests pin child order, isolated state, no Peer Gateway or session store, and that stopping the plugin leaves no orphaned link process or published projection.
- [x] 4.2 Make schema-2 Peer readiness require both a ready Collie child and a successful local-projection probe, and recover a failed link child without restarting Collie; verify focused lifecycle tests cover link loss, retry and recovery.
- [x] 4.3 Extend role-aware control status with the link layer and its retry posture while keeping schema-1 control JSON and formatted status byte-compatible; verify focused protocol tests report the link state with no identity, key, host-key, secret, certificate or browser credential.
- [x] 4.4 Extend the read-only Pack authority module so a schema-2 Lead requires set equality between its configured reachability member ids and Collie's enrolled member set, failing closed before any child starts; verify focused tests cover agreement, an extra mapped member, a missing mapped member, and byte-unchanged trust state in every case.

## 5. Reconcile the fork and source artifacts

- [x] 5.1 Extend the existing `fleet-runtime` contracts and focused verification list in `FORK.toml` for the new owned module without a redundant owned block or invasive path; verify the fork checker accepts only owned `fleet/**`, docs, Changelog and OpenSpec edits.
- [x] 5.2 Add one concise `CHANGELOG.md` entry and update the synthetic public configuration documentation for both new tables with no live endpoint, account, port, path or device fact; verify the examples parse and the privacy scan finds no deployment fact.
- [x] 5.3 Run focused configuration, reachability, lifecycle, protocol and authority tests plus affected typecheck, lint, fork, version and OpenSpec checks during implementation; resolve failures without weakening the loopback, restriction, bounded-recovery or trust boundaries.

## 6. Validate, publish, stage, and archive

- [x] 6.1 At commit readiness run the full root suite and, on a checkout free of concurrent edits, the full Web suite exactly once with pinned Bun 1.3.14, plus both typechecks, full-tree lint, production build, version/fork checks, strict OpenSpec validation, a privacy/scope audit and an exact staged-diff review; record the counts and do not rerun a passing full suite.
- [ ] 6.2 Commit the complete feature as one conventional commit with the required trailers, fetch and verify `origin/v3-dev`, push normally, and verify the remote exact commit.
- [ ] 6.3 Deploy only the exact pushed candidate to existing isolated Lead staging with its unchanged configuration and the existing controller; verify readiness, that the Lead's behavior is unchanged with no reachability list configured, and that trust, configuration, STT, Push, v2 and Herdr state are untouched, then update deployment state.
- [ ] 6.4 If source verification and non-mutating staging checks are complete without contacting a real Peer or changing Pack state, sync all three capability deltas, archive, commit and push the archive separately, and redeploy the exact archive HEAD; otherwise leave the clean pushed change active and record the precise external gate.
