## Why

The tree corresponds to Collie `v1.5.2` (commit `cea2035e1f02d560d1bac66c85314828a7e01c20`), and
upstream has since published `v1.5.3`–`v1.8.2`: 236 commits over 562 files. `v1.8.x` is the one
release line where the renamed crew wire (protocol version 2, `/crew/v1/*`) and the old
`/pack/v1/*` shapes coexist — a `v1.8` lead still answers `/pack/v1/*`, and a `v1.8` dialler falls
back to it once against an older side. `v1.9.0` removes both halves of that overlap. Adopting
`v1.8.2` first lets this fork move its own code to crew naming and protocol version 2 while members
still on this product's current release keep talking to a new lead, and lets that move be proven on
the members before the overlap disappears.

The adoption gate is not yet trustworthy for this release: the preflight's changed-path list is
blind to renames, so a port whose upstream file moved (`bridge/pack/forward.ts` →
`bridge/crew/forward.ts`, `PACK_PROTOCOL.md` → `CREW_PROTOCOL.md`, `web/src/routes/pack.tsx` →
`web/src/routes/crew.tsx`) is reported as untouched on that path. That is fixed first.

## What Changes

- **Prerequisite:** the adoption preflight counts both sides of an upstream rename as a disturbed
  path and names the destination, independent of the operator's Git rename configuration; covered
  by a focused test that exercises the real Git invocation.
- Adopt Collie `v1.8.2` — tag object `5bfd5b9707ee5f4ea64b6ee05eda51b7a4264fac`, commit
  `78f74d1e3d1638a8e7889e58c610726582bafd1b` — as a true three-way merge whose second parent is that
  commit, after a clean-tree preflight; conflicts are resolved inside declared `FORK.toml` entries,
  and `CLAUDE.md` stays the relative symlink to `AGENTS.md`.
- Move the fork's own code onto upstream's crew vocabulary and wire: imports from `bridge/crew/`,
  `CREW_PROTOCOL_VERSION`/`CREW_ENROLL_PATH`/`crewId`, `CrewProvider`/`useCrew`, `fetchCrew` and
  `/api/crew`, the manual Pane fit route on `/crew/v1/pane/:id/resize` in `CREW_PROTOCOL.md`, and the
  lead's probe budget projected as `COLLIE_CREW_TIMEOUT_MS`.
- The public Gateway denies `/crew/v1/*` exactly as it denies `/pack/v1/*`.
- Fleet reads Collie's trust state under the name the adopted Collie uses, and reads the previous
  name read-only while Collie has not yet made its own one-time rename; the explicit enrolment path
  runs Collie's own one-time state move before it opens the store. The runtime still never writes,
  renames or migrates trust state.
- Manual Pane fit is offered from the capability answer of the machine the Pane is on, following
  upstream's per-host capability rule.
- Re-point `FORK.toml` paths that upstream renamed, review all 21 invasive entries and advance each
  to `reviewed = "v1.8.2"`, set `[upstream]`, add the `UPSTREAM.md` row, and retain Collie's history
  with `v1.8.2`'s changelog as the byte-exact prefix of `COLLIE_CHANGELOG.md`.
- Cut this product's release **3.4.0** (MINOR, from 3.3.0; owner-confirmed 2026-09-30) in the same
  change, tag `v3.4.0` and push it by name. No GitHub Release is created. The accepted rollback
  asymmetry — 3.4.0 → 3.3.x needs Collie's `crew-*.json` state renamed back to `pack-*.json` — is
  stated in the 3.4.0 changelog entry. The change stays active until every member runs 3.4.0.

What the release brings is upstream's: the crew rename and protocol version 2, per-host multiplexer
capabilities, update-flow hardening, a real-browser CI tier, Hermes and omp transcripts, attachment
upload changes, a clipped-reply display row, the playground reorganisation, and many fixes. None of it
is specified here.

**Non-goals:**

- No specification of upstream behavior, and no port beyond what the release requires.
- No rename of this fork's own vocabulary: the private configuration keeps its `[pack]` section,
  `FORK.toml` entry ids and the `fleet-pack-*` capability names stay, and fork module and error-text
  names are left for a later change. Renaming an operator-facing key would be a MAJOR on its own.
- Not crossing `v1.9.0`, and not removing the `REMOVE_IN_1_9_0` overlap.
- **Deployment is out of scope.** Levelling the members, proving the release on them, and every
  change to the operator's own deployment tooling, configuration, runbooks and rollback belong to the
  operator's private deployment repository, not to this product. This change ends at the push of the
  release that carries the merge; `design.md` lists what the deployment side must change so it can
  be planned.
- No change to the Fleet lifecycle posture, enrolment sequence, trust boundaries or reachability
  transport.

## Capabilities

### New Capabilities

None. An adoption imports upstream behavior, and upstream behavior is not specified here.

### Modified Capabilities

- `fleet-upstream-sync`: the preflight reports a declared path an upstream rename moved, on both of
  its sides, regardless of Git's rename configuration.
- `fleet-pack-authority`: the Gateway denies the crew wire prefix as well as the pack one; trust state
  is read under the adopted Collie's file name with a read-only fallback to the previous name, and
  explicit enrolment performs Collie's own one-time state move; the protocol document is
  `CREW_PROTOCOL.md`.
- `fleet-runtime-configuration`: the lead's probe budget is projected under Collie's current variable
  name, and both the current and the previous spelling are reset first.
- `fleet-version-evidence`: member versions are reused from the crew census (`/api/crew`).
- `fleet-manual-pane-fit`: availability follows the Pane's own Host capability; the resize route is
  carried on the crew link and reaches a member on the previous protocol through upstream's
  one-release overlap.

## Impact

- Everything Collie changed between `v1.5.2` and `v1.8.2`.
- Predicted conflicts (read-only `git merge-tree`): 23 paths, every one inside a declared entry.
- Fork-owned: `scripts/check-fork.ts` and its test, `fleet/` (authority, enrolment, environment,
  configuration, gateway, manual Pane fit and their tests), native navigation and fleet components
  that read the crew provider, `docs/herdr-fleet.md`.
- Invasive: ports in `bridge/`, `web/src/`, `CREW_PROTOCOL.md`, `AGENTS.md`, hooks and manifests, as
  enumerated in `FORK.toml`.
- `FORK.toml`, `UPSTREAM.md`, `COLLIE_CHANGELOG.md`, `CHANGELOG.md`, and the three version files.
- Operators: members must redeploy (MINOR); a member left on 3.3.x keeps working with a 3.4.0 lead
  only until the next adoption crosses `v1.9.0`.
