## Why

The tree corresponds to Collie `v1.8.2` (tag object `5bfd5b9707ee5f4ea64b6ee05eda51b7a4264fac`,
commit `78f74d1e3d1638a8e7889e58c610726582bafd1b`, Fleet 3.4.0), and upstream has since published
`v1.9.0`–`v1.14.2`: 440 commits over 971 files. `v1.8.x` was the one release line that carried the
crew-wire overlap; 3.4.0 used it to move this fork onto crew naming and protocol version 2, and every
member of the fleet now runs 3.4.0. That was the precondition for crossing `v1.9.0`, which removes
the overlap, so the fork can now catch up to upstream's current release in one step rather than
falling further behind a fast-moving line (six minors in a fortnight).

Three things in that range reach the fork's own code rather than only its ports, and decide the
shape of this change: `v1.9.0` deletes the overlap modules the fork imports (`bridge/crew/v1-overlap.ts`,
`bridge/crew/state-migration.ts`); `v1.9.0` adds layered `config.toml` files that sit under the
environment Fleet sanitizes; and `v1.10.0` stops Collie from reading `HERDR_PLUGIN_STATE_DIR`, which
is how Fleet tells its Collie child where its state — the crew trust store included — lives. Left
unported, the last one would silently start Collie against a different state directory from the one
Fleet validated.

## What Changes

- Adopt Collie `v1.14.2` — tag object `5271116783decc927b84b4da9814d5fbef6277b7`, commit
  `887a37dbfc5582d08c7d7703deadd53146f654bb` — as a true three-way merge whose second parent is that
  commit, after a clean-tree preflight; conflicts (35 paths, all inside declared entries) are resolved
  from the entry that predicted them, and `CLAUDE.md` stays the relative symlink to `AGENTS.md`.
- Fleet states Collie's state directory as `COLLIE_STATE_DIR` (reset first, then set to the same
  directory as today), because the adopted Collie ignores `HERDR_PLUGIN_STATE_DIR`. Nothing moves on
  disk.
- Collie's own `config.toml` files cannot decide a setting Fleet owns: the Collie child's state
  directory, bind, ingress, origin and identity settings, the crew timing Fleet projects, and the new
  `COLLIE_BASE_PATH` are reset and, where Fleet decides them, set in the environment, which wins over
  both files; a Collie config file that names one of them refuses Fleet's start, naming the file and
  the key and never the value.
- Retire what the overlap removal made dead in the fork's own code: the trust reader's read-only
  fallback to the 1.7.0 file name, the enrolment's call to Collie's one-time state move (both now
  refuse a legacy-only state directory with Collie's own notice), the reset of the removed
  `COLLIE_PACK_TIMEOUT_MS`, and the manual-fit overlap assertions.
- Re-point the agent rail's attention set to where upstream moved it (`ATTENTION`, now exported from
  `web/src/lib/triage.ts`).
- Resolve four product trade-offs at the boundary (design decisions 6–9, decided by the
  coordinator on 2026-10-01 as A1, B1, C1 and D1): upstream's dashboard footer tabs beside the
  fork's rails, the record control inside upstream's one-box composer, the pane-surface route and
  network-first navigation under upstream's new router and service worker, and the command bar's
  anchors in the composer and root.
- Review all 23 invasive entries and advance each to `reviewed = "v1.14.2"`, set `[upstream]`, add the
  `UPSTREAM.md` row, and make `v1.14.2`'s changelog the byte-exact prefix of `COLLIE_CHANGELOG.md`
  (no retained heading was dropped, so no seam).
- Cut this product's release in the same change at the axis design decision 12 recommends (MINOR,
  3.4.0 → 3.5.0), tag it and push it by name, publishing nothing. The change stays active until every
  member runs the release.

What the release brings is upstream's: the actions belt and harness shortcuts, the config file and
`collie config`, prompt-cache countdowns and the cold-cache push, the dashboard's workspace filter and
fixed pane order, the Muse and OpenCode readers, base-path serving, the one-box composer with
attachment chips, the Changes view, the dashboard footer tabs, update mode, pinning, hiding a machine,
the harness canary, translated catalogs and many reader fixes. None of it is specified here.

**Non-goals:**

- No specification of upstream behavior, and no port beyond what the release requires.
- No rename of this fork's own pack vocabulary (`[pack]` section, entry ids, `fleet-pack-*` names).
- No adoption of `collie update`, update mode or `collie config` as Fleet workflows: Fleet installs and
  updates as a Herdr plugin, and the private Fleet configuration stays the one file an operator edits.
- No base-path deployment: Fleet's Gateway keeps serving Collie at its root.
- **Deployment is out of scope.** Levelling the members and every change to the operator's own
  deployment tooling belong to the private parent repository; `design.md` lists what it must know.

## Capabilities

### New Capabilities

None. An adoption imports upstream behavior, and upstream behavior is not specified here.

### Modified Capabilities

- `fleet-pack-authority`: trust state is read under the current file name only; a state directory
  holding only the 1.7.0 name fails closed with Collie's own notice, at validation and at enrolment;
  members on different protocol versions are Collie's to refuse, not an overlap to ride.
- `fleet-runtime-configuration`: the probe budget is projected under its one current name; Fleet
  states the Collie child's state directory explicitly; Collie's configuration files cannot decide a
  Fleet-owned setting.
- `fleet-manual-pane-fit`: the resize route rides the crew link on the one protocol the adopted Collie
  speaks; the overlap requirement and its two scenarios are retired.
- `fleet-agent-favorites`: upstream replaced the dashboard's four triage sections with workspace groups
  and a Pinned group; favorites now lead their own workspace group, the Pinned group is unaffected,
  and the Agent rail keeps the triage buckets with favorites first inside each.
- `fleet-upstream-sync`: an entry upstream rewrote in place under a heading it still carries is
  upstream's correction, not a dropped entry, and needs no seam.
- Following the coordinator's decisions (A1, B1, C1, D1): `fleet-composer-voice` (the record control inside the
  one-box composer; an attachment makes a draft non-blank), `fleet-pane-chrome` (no composer status
  band and no second host chip; the control-rank requirement retired because upstream's belt now does
  it) and `fleet-native-navigation-sidebars` (the rails stay the fleet's map beside upstream's footer
  tabs, unaffected by dashboard hide/pin). The coordinator chose the recommended options, so the
  deltas stand as written.

## Impact

- Everything Collie changed between `v1.8.2` and `v1.14.2`, including new runtime dependency
  `sugar-high` and the compiled-CLI build script.
- Predicted conflicts (read-only `git merge-tree`): 35 paths, 86 hunks, every one inside a declared
  entry; no declared path renamed; no owned path occupied.
- Fork-owned: `fleet/collie-env.ts`, `fleet/pack-authority.ts`, `fleet/pack-enrollment.ts`,
  `fleet/manual-pane-fit/capability.test.ts` and their tests; `web/src/components/native-agent-rail.tsx`;
  `docs/herdr-fleet.md`.
- Invasive: ports in `bridge/`, `web/src/`, `AGENTS.md`, hooks and manifests, as enumerated in
  `FORK.toml`.
- `FORK.toml`, `UPSTREAM.md`, `COLLIE_CHANGELOG.md`, `CHANGELOG.md`, and the three version files.
- Operators: every member redeploys (MINOR), lead first. No Fleet configuration key, enrolment step or
  state file changes.
