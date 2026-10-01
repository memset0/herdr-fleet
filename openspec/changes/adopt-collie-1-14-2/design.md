## Context

See proposal.md — Why. The ground as read before anything was changed (all read-only, in a scratch
clone made with `git clone --shared`):

```
baseline  v1.8.2   tag 5bfd5b97…  commit 78f74d1e…   (FORK.toml [upstream]; = merge-base HEAD v1.14.2)
target    v1.14.2  tag 52711167…  commit 887a37db…   440 commits, 971 files
preflight (bun scripts/check-fork.ts --target v1.14.2 --allow-active-changes, before this change existed):
          20 of 23 invasive entries disturbed; 3 untouched (native-pane-chrome-port,
          private-fact-guard-port, downstream-docs); no declared path renamed; no owned path occupied
```

`git merge-tree --write-tree --name-only HEAD v1.14.2` predicts 35 conflicted paths and 86 hunks,
every one inside a declared entry:

| entry | conflicted paths (hunks) |
| --- | --- |
| `repository-guidance` | `CLAUDE.md` (distinct types) |
| `lint-parse-boundary` | `.oxlintrc.json` (1) |
| `downstream-version-line` | `CHANGELOG.md` (2), `web/package.json` (1) |
| `plugin-identity` | `herdr-plugin.toml` (1) |
| `fleet-build-port` | `package.json` (1) |
| `fake-network-fleet-routes` | `web/src/test/handlers.ts` (1) |
| `native-row-actions-menu-port` | `web/src/components/tab-strip.tsx` (1) |
| `native-pane-content-port` | `web/src/routes/detail.tsx` (2) |
| `declined-centred-history-column` | `web/src/routes/history.tsx` (1) |
| `authenticated-navigation-cache` | `web/src/sw.ts` (3) |
| `composer-voice-rank-port` | `web/src/components/composer-stt.test.tsx` (2) |
| `upstream-removal-clock` | `bridge/removal-schedule.test.ts` (1) |
| `native-navigation-sidebars-port` | `web/src/routes/root.tsx` (1), `web/src/routes/settings.tsx` (1), `web/src/playground/sections/motion.test.tsx` (2) |
| `native-agent-favorites-port` | `agent-list.tsx` (4), `agent-list.test.tsx` (6), `agent-card.tsx` (5), `agent-card.test.tsx` (1), `routes/home.test.tsx` (3), the seven `lib/i18n/messages/*.ts` (2 each) |
| `native-manual-pane-fit-port` | `web/src/components/agent-chat.tsx` (12), `composer.tsx` (7), `agent-chat.test.tsx` (5), `bridge/server.ts` (3), `bridge/crew/forward.ts` (2), `forward.test.ts` (2), `bridge/solo-baseline.test.ts` (1) |

Clean auto-merges that still matter: `bridge/mux/herdr/adapter.ts`, `bridge/mux/{types,capabilities}.ts`,
`bridge/state-engine.ts`, `web/src/router.tsx`, `web/src/routes/home.tsx`, `display-prefs.tsx`,
`docs/voice-and-push.md`, `cli/program.test.ts`, `web/e2e/service-worker.spec.ts`,
`.github/workflows/{ci,release}.yml`. Upstream deleted `bridge/crew/v1-overlap.ts`,
`bridge/crew/state-migration.ts` (+test), `web/src/lib/pane-tag.ts`, `web/src/lib/types.test.ts` and
`web/src/test/pwa-register-stub.ts`; no declared path is among them, but two fork-owned modules import
the first two.

What `v1.9.0`–`v1.14.2` require of an operator, read from the changelog and the source:

- **Crew wire.** `v1.9.0` removes every 1.7/1.8 overlap: `/pack/v1/*`, `COLLIE_PACK_*`, the
  `pack-*.json` move, `/api/pack`'s 308 and the `packId` readers. Protocol stays 2; the protocol floor
  is 1.8.0, below which a member reads `incompatible`. A legacy-only state directory is named at start
  and Collie stays solo. Every member already runs 3.4.0 (Collie 1.8.2), whose Collie moved its state
  files, and the private parent's controller already polls `/api/crew`.
- **Configuration files.** `v1.9.0` adds `~/.collie/config.toml` (or `COLLIE_CONFIG`) and
  `<configDir>/config.toml`, where `configDir` is `HERDR_PLUGIN_CONFIG_DIR` — Fleet's own plugin
  configuration directory. Precedence is default < home file < instance file < process environment
  (the `.env` included), applied by the bridge to every name the environment does not already carry.
  Every Collie setting Fleet resets today, and the new `COLLIE_BASE_PATH`, has a file key. Neither file
  exists on a Fleet machine today.
- **State directory.** `v1.10.0` (`d07ec4c4`, issue #226) makes `resolveStateDir` read only
  `COLLIE_STATE_DIR`, then `~/.local/state/collie`; `HERDR_PLUGIN_STATE_DIR` is ignored on purpose.
  Fleet starts its Collie child with `HERDR_PLUGIN_STATE_DIR=<fleet state>/collie` and validates trust
  in that directory, so the merged Collie would open a different store from the one Fleet validated.
  `bridge/config.ts` is not a declared path and auto-merges: nothing in the boundary would report it.
- **Update path.** `v1.10.0` refuses an update when `bun --version` fails, and builds the CLI in a
  private staging folder under a real `bin/`. Both live in `collie update` and `collie build`. Fleet
  never runs `collie update`; the deployment builds with `bun run build` in a fresh clone, whose `bin/`
  is a real directory. `collie build`'s own version gate is still `scripts/check-version.sh`.
- **Runtime.** New web dependency `sugar-high`; `MIN_BUN` unchanged (1.3.14); `min_herdr_version`
  unchanged (0.7.0); the browser tier adds WebKit (always on in CI, opt-in locally).

**Answer: no operator configuration changes.** The private Fleet configuration, the enrolment
sequence, state-file names and the census path the deployment polls are all unchanged; the two
environment consequences are Fleet's to project (decisions 3 and 4). The only new obligation is
negative: a Collie `config.toml` must not set what Fleet owns, which no machine does today.

## Goals / Non-Goals

**Goals:**

- `v1.14.2` in this history as real ancestry, every port reviewed against it, and the fork's own code
  on the post-overlap upstream with nothing kept alive for a removed upstream path.
- Collie keeps opening the state Fleet validated, and nothing in Collie's new configuration files can
  move a setting Fleet decides.
- The four product trade-offs decided explicitly at the boundary rather than by whichever side of a
  conflict was easier to keep.

**Non-Goals:**

- A base-path deployment, `collie config` as a Fleet workflow, or `collie update` / update mode as a
  way to level members.
- Renaming this fork's own pack vocabulary.
- Any member deployment, and any edit to the operator's deployment tooling.

## Decisions

### 1. Preflight, planning commit and the merge, as in the previous adoption

This change's planning artifacts are committed on their own, planning-only, before the preflight
runs, because the preflight refuses untracked paths. Once committed, this change is itself an active
change, so the preflight runs with `--allow-active-changes` **only after the owner (or the
coordinator acting for the owner) states that authorization for this adoption**; the tasks record
who gave it. **Decided (coordinator, 2026-10-01):** the owner authorized the whole adoption sequence
on 2026-10-01, which covers running the preflight with this change active. The preflight is expected to repeat the read-only report above (20 disturbed, 3
untouched, no rename, no owned collision).

`git merge --no-ff --no-commit v1.14.2`; verify `MERGE_HEAD` is `887a37dbfc5582d08c7d7703deadd53146f654bb`;
resolve; commit only after every gate. Upstream's file is the base and the port is re-applied on top.
Contracts: `CLAUDE.md` stays the relative symlink (upstream's regular file is not read into it, and no
`CLAUDE.md~v1.14.2` survives); `CHANGELOG.md` stays ours with one Unreleased line; version files keep
`3.4.0` until the release commit; `herdr-plugin.toml` keeps this product's identity;
`COLLIE_CHANGELOG.md` becomes `v1.14.2`'s changelog verbatim (decision 11). The merge commit records
the merge and its conflict resolution only; the fork-side migration (decisions 2–5) follows as its own
commit on `main`, nothing released or pushed between the two, exactly as 3.4.0 was phased. The merge
commit knowingly does not typecheck where fork code still imports the two deleted modules.

#### Phase A record (2026-10-01)

- Baseline before the change: `bun run test:fork` 20 pass and the boundary check clean;
  `bun test ./fleet` 590 pass, 0 fail; hooks active; `main` level with `origin/main` at `e3b6f87e`.
- Planning commit `61eb15e2`. Preflight `check-fork.ts --target v1.14.2 --allow-active-changes`
  (authorization above): tag object `5271116783decc927b84b4da9814d5fbef6277b7`, commit
  `887a37dbfc5582d08c7d7703deadd53146f654bb`, 20 disturbed, 3 untouched (`native-pane-chrome-port`,
  `private-fact-guard-port`, `downstream-docs`), no moved declared path, no owned path occupied.
  `merge-tree` and the opened merge both gave the 35 predicted paths.
- Merge commit `67a62f98` (parents `61eb15e2`, `887a37db`). Guard A was skipped for it with
  `SKIP_VERSION_CHECK=1`, as for 3.4.0's merge: with 971 staged paths, the hook's
  `echo "$staged" | grep -q` under `pipefail` intermittently loses the pipe and reads a staged
  `CHANGELOG.md` as unstaged (reproduced outside the hook). Version consistency and the added
  Unreleased bullet (2 against 1) and its shape were checked by hand. The same race affects
  `check-crew-wire.sh` run standalone. It passed inside the hook, so no hatch was used for it.
- Resolutions that go beyond the tables above:
  - Favorites (`native-agent-favorites-port`): upstream replaced the dashboard's triage sections with
    workspace groups in fixed order plus a Pinned group. The favorite control is re-applied on every
    row, and favorites lead their own workspace group. Nothing crosses a group, and Pinned stays in
    place order. `fleet-agent-favorites` still speaks of the four triage sections, which no longer
    exist. **That requirement needs a delta in this change before archive.** Upstream's tests that
    counted or named row buttons were scoped to the row's own slot, because every row now has a
    favorite button beside it. The removed `home.sort.*` keys were dropped with upstream.
  - Pane switcher (`native-navigation-sidebars-port`): upstream deleted the grip above the composer
    that carried `xl:hidden` and moved the entry onto the actions belt as the Switch pill. The rail
    breakpoint is re-applied in `agent-chat.tsx` by handing the belt no handle at `(min-width:
    80rem)`, which keeps the requirement "Wide viewport hides the pane-switcher entry" true. The
    fork's test now asserts the absence at that width.
  - Composer (B1): the fork's `data-slot="composer-dock"` lost its last reader and was dropped.
  - Command bar (D1): the bar listens on `document` in the capture phase and the tour's dialog traps
    only Tab, so the first-use tour cannot swallow the prefix. This was checked by reading the
    source. A browser check stays with 8.3.
- Input to group 6, beyond decision 2's table: fork-owned `fleet-row-actions.tsx`,
  `native-navigation-shell.tsx` and `lib/fleet-roster.ts` import `paneDisplayName`, which upstream
  removed (`6e8eeafc`; its successor is `paneName` in `lib/pane-name.ts`). `native-agent-rail.tsx`
  imports `sectionHeaderProps`, which upstream removed (`bac490b4`), as well as `ATTENTION`. The
  playground walkthrough (`motion.test.tsx`) fails at runtime until `paneDisplayName` is replaced.

#### Phase B record (2026-10-01, task group 6)

Commit `6c6cd636` (`feat(fleet)!: …`, with a `BREAKING CHANGE:` footer worded by the coordinator:
the 3.5.0 wire floor, the legacy-only refusal and the config-file refusal). What it did, beyond the
tables in decisions 2–4:

- **State directory (decision 3).** `collieChildEnv(config, collieStateDir, inherited)` resets and
  sets `COLLIE_STATE_DIR`; `runtime.ts` exports `collieSpecEnv`, which `childSpecs` uses and which no
  longer overrides `HERDR_PLUGIN_STATE_DIR`. `fleet/collie-env.test.ts` proves, through upstream's
  own `resolveStateDir`, that the child env built by `collieSpecEnv` resolves to exactly
  `paths.collieStateDir` — the value `daemon.ts` and `control.ts` hand `validatePackAuthority` — from
  an environment carrying a foreign `COLLIE_STATE_DIR` and a foreign Herdr plugin state variable.
- **Configuration files (decision 4).** `assertCollieConfigFilesCede(childEnv)` resolves both paths
  with upstream's `configFilePaths(childEnv, home, resolveConfigDir(childEnv, home))` (home from the
  child's `HOME`), reads them with `readConfigFilesSync`, and throws `<file> sets [<section>] <key>,
  which Herdr Fleet owns; remove it from that file`. `daemon.ts` and `control.ts` call it right after
  `validatePackAuthority`, so the operator sees the refusal from the start action. Refinement folded
  in: a value Collie would reject for an owned key is refused too (it arrives as a `ConfigProblem`
  naming the section and key, never as a layer value), because the operator meant to set it. The
  owned set is exported as `FLEET_OWNED_COLLIE_SETTINGS` (19 names: the previous reset list without
  `COLLIE_PACK_TIMEOUT_MS`, plus `COLLIE_STATE_DIR` and `COLLIE_BASE_PATH`); none is secret-kind, so
  no owned key can be withheld as `file:blocked`. Tests: no file; only non-owned keys in both files;
  an owned key in the machine file and in the instance file (file and key named, value absent);
  a rejected owned value; `COLLIE_CONFIG` redirecting the machine file; an inherited base path
  removed.
- **Legacy state (decision 2).** Upstream kept `legacyStateFileNotice` (`bridge/crew/trust-store.ts`,
  ADR 0045), so the fork reuses its text verbatim through `assertNoLegacyOnlyTrustState`: validation
  refuses before any reader runs (an injected accepting reader is never called), and enrolment
  refuses both mint and join before opening the store, leaving the directory byte-for-byte unchanged.
  The read-only io lost its fallback and its state-dir argument; a new case opens a `TrustStore`
  through it and requires `update` to reject with the directory still empty, and swapping in a
  writing io was checked to fail that case.
- **Removed overlaps.** The `COLLIE_PACK_TIMEOUT_MS` reset and every `LEGACY_CREW_TIMEOUT_ENV` use; the
  `v1-overlap` import and both overlap cases in `fleet/manual-pane-fit/capability.test.ts` (the crew
  route-table assertions stay, now with the crew-prefix dial and the member-side dispatch). That file
  had not run since the merge because its import no longer resolved; once it did, its source
  assertion on the Pane route's read classification met upstream's new `isPaneReadAction`, and it now
  asserts that call and that `resize` is not a read.
- **Renamed upstream symbols.** `ATTENTION` from `@/lib/triage`; `sectionHeaderProps` (removed by
  `bac490b4`) is inlined as the four `SectionHeader` props in the fork-owned rail; `paneDisplayName`
  (removed by `6e8eeafc`) becomes `paneName` in `fleet-row-actions.tsx`, `native-navigation-shell.tsx`
  and `lib/fleet-roster.ts`. `paneName` also falls back to a named one-pane tab's label, so the rails,
  the roster and the context menu now name such a pane as every upstream screen does.
- **`/api/pack`.** No reference remains in `fleet/**`, `web/src/components/fleet-*`, `native-*` or
  `web/src/lib/fleet-*`; the Gateway's deny of `/pack/` stays (decision 2) and its comment says it
  denies a retired prefix.
- **Docs.** `docs/herdr-fleet.md` gains "The Collie child's environment" (every owned setting, the
  state-directory variable and the config-file rule) and states the 3.5.0 floor; `AGENTS.md`'s
  overlap parenthetical is replaced and the multi-host section gains the environment rule and floor.
- **Favorites.** The `fleet-agent-favorites` delta renames the requirement to "Favorites sort first
  only inside their own group" and restates it for workspace groups with the Pinned group unaffected;
  the Agent rail keeps the triage buckets. A new rail case pins that a machine hidden and a pane
  pinned on the dashboard leave both rails' rows and order unchanged.
- **Results.** Both typechecks clean; `bun run lint` clean; `bun test ./fleet` 599 pass / 0 fail
  (590 before, plus the new cases); web vitest for the touched components and the 5.4 set (root,
  settings, motion, detail, history, tab-strip) pass — `motion.test.tsx` runs again now that
  `paneName` resolves.

#### Phase C record (2026-10-01, task group 8)

Two commits on `main`: `cb531ffa` (`fix(web)`, a real defect) and `a92c90b1` (`fix(fork)`, test-side
ports declared in `FORK.toml`, now 92 invasive paths). Nothing pushed, tagged or bumped.

- **Local (8.1, 8.4).** `bun run test:fork`, `scripts/check-fork.ts`, `scripts/check-private-facts.ts`,
  `scripts/check-version.sh`, `scripts/check-crew-wire.sh` (nothing staged), both typechecks and
  `bun run lint` clean; the hook suites (`pre-commit`, `check-tag`, `check-flake-lock`,
  `check-payload-links`) pass; `bun test ./fleet` 599 / 0; the 4.x–6.x bridge files pass; all 30
  `bridge/crew/*.test.ts` files pass file by file; `cli/*.test.ts` file by file pass except
  `cli/tools.test.ts` "the same shim is not matched on linux", which finds this host's own `herdr` in a
  well-known directory (environmental; it passes on the designated member); full web vitest 301 files,
  13500 pass and one failure, fixed below. `scripts/release-notes.test.ts` passes before the release
  bump, once its two credit cases read Collie's changelog (below).
- **Designated member (8.2).** Tree brought to the change's head by an incremental bundle (the
  upstream tags were already present). With a private `TMPDIR` — the shared host's `/tmp` holds another
  user's empty `.git` directory, which made two `bridge/changes.test.ts` discovery cases find `/tmp`
  as a repository; both pass under a private temporary directory — `bun test ./bridge` file by file:
  119 files, 3618 pass, 0 fail, 2 timed out (`bridge/stt/codex`, `bridge/stt/openai`, the known hangs
  owned by `fix-stt-test-exit`); `bun test ./cli` file by file: 42 files, 1612 pass, 1 fail (below);
  `bun test ./fleet` 599 / 0; `bun test ./scripts` 186 / 2 (below); `bun run test:crew` 63 / 0; all
  nine shell suites, both typechecks and lint pass; web vitest 13500 pass / 1 fail (below). Re-run
  after the fixes: `cli/update-check.test.ts` 78 / 0, `bun test ./scripts` 188 / 0, `bun test ./fleet`
  599 / 0, web vitest 301 files, 13501 pass / 33 expected fail / 47 todo / 0 fail.
- **Upstream cases that met a port, settled at the boundary** (`a92c90b1`; same treatment as 3.4.0's
  phase C2 — scope a query, adapt a locator to the fork's surface, or skip where the premise is absent
  by design, never weakening an assertion about upstream's own surface):

  | case | met | settled |
  | --- | --- | --- |
  | `cli/update-check.test.ts` protocol floor reads `## [1.8.0]` from `CHANGELOG.md` | `downstream-version-line` | reads `COLLIE_CHANGELOG.md` |
  | `scripts/release-notes.test.ts` 1.12.0 / 1.12.1 credits | `downstream-version-line` | read `COLLIE_CHANGELOG.md`; the newest-section and Unreleased checks still read `CHANGELOG.md` |
  | `web/src/components/stable-order.test.tsx` dashboard order | `native-agent-favorites-port` | only row-slot buttons |
  | `e2e/dashboard-footer` all-clear (phone) | `native-navigation-sidebars-port` | inside `main`; the Agents rail repeats the line |
  | `e2e/pinned-panes` Changes A2 (phone) | `native-navigation-sidebars-port` | only row-slot buttons (favorite control beside each row) |
  | `e2e/back-goes-up` A (phone) | `native-navigation-sidebars-port` | the switcher sheet holds the Agents rail: its dialog and codex row by logo |
  | `e2e/pinned-panes` switcher (phone) | `native-navigation-sidebars-port` | skipped: the rail ignores dashboard pins (decision 6) |
  | `e2e/back-goes-up` D and the slide case, `e2e/pane-glide` ×4 back-arrow cases (phone) | `native-navigation-sidebars-port` | skipped: the Pane route declines the Collie mark, which is their up control |
  | `e2e/codex-padding` ×2 (tablet only) | `native-manual-pane-fit-port` (declined 768px column) | skipped on the tablet project: at the route column's full width the two agents' session notes wrap to 1 and 2 lines, a 16.5px gap difference; upstream's tree passes at 752px, and the phone project still runs the case |

- **Defect fixed (`cb531ffa`).** Adapted to the fork's switcher, `back-goes-up` A still failed: the
  native navigation shell pushed every pane it opened, so Back from a pane reached sideways returned
  to the pane just left, against upstream's ADR 0067 (1.13). The shell now opens panes through
  upstream's `useNav().open` (push from a dashboard or space, replace from a pane); the adapted case and
  the shell, rail, command and Pane-page suites pass. One `CHANGELOG.md` line.
- **Browser tier (8.3).** `cd web && bun run e2e` (Chromium; WebKit not run on this host): first run 158
  passed / 12 failed / 90 skipped; after the ports and the fix 161 passed / 0 failed / 99 skipped. On
  the phone project the skips are the two declared network-first `service-worker` cases (still
  skipped with `network-first navigation by design`), the seven above, upstream's WebKit-only
  `update-screen` variant and `filter-strip`'s own "every chip fits" skip; the rest are upstream's
  phone-only cases on the tablet project plus the two Codex tablet skips. `update-screen.spec.ts`
  passes in full, including "reloads once at step 6" under network-first navigation; the new
  dashboard-footer, belt and composer-clear specs pass.
- **UI check over CDP** (scratch build, synthetic MSW mock, 1366×900 and 390×844). A1: the
  Panes/Focus/Changes tabs sit in the app column (desktop x 284–1042) between the two rails and clear
  of the footer stamp; on the phone they span the width with the rails and drawer off screen; hiding a
  machine and pinning a pane change the dashboard and leave both rails' rows identical. B1: box order
  input → attach → record → Send at both sizes; the microphone stays with a draft; Send is disabled
  empty and while recording, enabled with a draft; the belt shows Changes and clear, then Undo after a
  clear; Switch shows on the phone and is absent at the rail breakpoint by design. C1:
  `/pane/:id/changes` and `/space/:id/changes` render inside the shell; the surface switch turns the
  Pane into the terminal surface and back; `/pack` lands on `/crew` through upstream's own client-side
  redirect (no server redirect remains). D1: with the first-use tour open, the prefix chord followed
  by `?` opens the command bar over it, and the direct chord opens it too; the footer reads
  `v3.4.0-dev · <sha>` before the bump.
- **Rollback probe (8.6) — pass.** In scratch directories, a 3.5.0 lead minted an invite and a peer
  enrolled through Fleet's own enrolment against the running 3.5.0 lead, both written with 3.5.0
  code; both came up as `lead` and `peer`. Then `v3.4.0`'s tree (from `git archive`) was started
  against the same directories, through the variable 3.4.0 sets (`HERDR_PLUGIN_STATE_DIR`): `lead` and
  `peer` again, the same crew id and member ids, the peer reachable from the lead across the two
  versions; 3.4.0's and 3.5.0's `validatePackAuthority` both accept both directories. The trust stores
  were byte-identical before and after the 3.4.0 run and no file was renamed (only `crew-runtime.json`
  was refreshed). No deployed instance was touched.
- **Public-tree audit (8.5).** The private-fact guard passes; the two commits and this change's
  artifacts name no host, address, path, credential, mesh or parent tooling; `check-fork.ts` reports
  no unclassified path.

### 2. The fork sheds what the overlap removal made dead

| fork file | change |
| --- | --- |
| `fleet/pack-authority.ts` (+test) | drop the previous-name fallback and its `crewStateFileMoves` import; keep the write-refusing read-only `TrustStoreIo` (upstream's default io no longer migrates, but the runtime-never-writes guarantee stays mechanical); a legacy-only directory fails closed with upstream's `legacyStateFileNotice` text; tests for current-only, legacy-only (refused, untouched), both-present and neither |
| `fleet/pack-enrollment.ts` (+test) | drop `migrateCrewStateOnce`; refuse a legacy-only directory with the same notice before opening the store; the legacy-store test becomes a refusal test |
| `fleet/collie-env.ts` (+test) | drop `COLLIE_PACK_TIMEOUT_MS` and its `REMOVE_IN_1_9_0` note (decisions 3 and 4 add to this file) |
| `fleet/manual-pane-fit/capability.test.ts` | drop the `v1-overlap.ts` import and the two overlap-direction assertions; keep the crew route-table and correspondence assertions |
| `fleet/upstream-version.test.ts` | asserts one upstream clock (`cli/program.test.ts`) instead of two (decision 10) |
| `web/src/components/native-agent-rail.tsx` | import `ATTENTION` from `@/lib/triage` where upstream moved it; the fork's re-export from `agent-list.tsx` is dropped, shrinking `native-agent-favorites-port` |
| `AGENTS.md` | the members paragraph that still describes the `/pack/v1/*` overlap is corrected |
| `FORK.toml` | reasons that cite the overlap (`native-manual-pane-fit-port`, `upstream-removal-clock`, `unnarrowed-pack-rows-port`) corrected at review |

Kept deliberately: the Gateway's denial of `/pack/` beside `/crew/`. Collie no longer answers the old
link prefix, so the rule now denies a path nobody serves; it costs one comparison, and removing a
deny rule from the public boundary is not the kind of simplification that buys anything. The
specification already permits it ("for as long as the adopted Collie answers either").

Alternative rejected for the trust reader: switching to Collie's default `TrustStore` io now that it
no longer renames. It would make the never-write property depend on upstream continuing to keep
`read()` side-effect free; the fork's io is a dozen lines and its mutation test already exists.

### 3. Fleet states the Collie child's state directory as `COLLIE_STATE_DIR`

`collieChildEnv` resets `COLLIE_STATE_DIR` and sets it to `paths.collieStateDir`, the directory
validation and enrolment already use. `childSpecs` stops overriding `HERDR_PLUGIN_STATE_DIR` for the
Collie child (Collie ignores it; the override would be a dead line). Nothing moves on disk. Test: a
child env built from an environment that carries a foreign `COLLIE_STATE_DIR` and the Herdr plugin
state variable resolves, through upstream's own `resolveStateDir`, to exactly Fleet's directory.

Alternatives rejected: porting `bridge/config.ts` back to honour `HERDR_PLUGIN_STATE_DIR` (a new
invasive path re-opening the split upstream closed in #226); moving Collie's state to its default
location (a state migration on every member, and a rollback hazard).

### 4. Collie's configuration files cannot decide a Fleet-owned setting

Fleet-owned set: every Collie name in today's reset list, plus `COLLIE_STATE_DIR` and
`COLLIE_BASE_PATH`. Each is reset in the child environment, and set where Fleet decides it — so the
environment wins over both files. For the names Fleet leaves unset on purpose (the serve-publication,
trusted identity and device-allowlist settings, and an unstated crew timing), a file could otherwise
fill the gap. Before spawning, Fleet resolves the two paths Collie will read with upstream's own
`configFilePaths(childEnv, home, resolveConfigDir(childEnv, home))`, reads them with upstream's own
synchronous reader, and refuses the generation when the layer sets any Fleet-owned name, naming the
file and the setting, never the value. Fleet never writes either file. No operator change: neither
file exists on a Fleet machine today.

Alternatives: pinning every unset name to an explicit default value (fragile — "unset" and "empty" are
not the same thing for every Collie key, and each default would be a copy of upstream's); pointing
`COLLIE_CONFIG` at an empty file (neutralises only the home file; the instance file sits in Fleet's
own configuration directory and cannot be moved without moving `commands.toml` and its siblings);
documentation only (leaves the sanitized-environment guarantee false on a machine where someone runs
`collie config init` in the plugin directory). Whether refusing is too strict — versus warning and
starting — is flagged at decision 12's re-assessment; the recommendation is to refuse, because the
settings concerned are the ingress and identity boundary. **Decided (coordinator, 2026-10-01):
refuse.** Fleet does not start when the home or instance `config.toml` sets a Fleet-owned key; the
error names the file and the key only, never the value.

### 5. Manual Pane fit merges as a union with upstream's Changes routes

`bridge/server.ts`: keep the fork's webfont CSP origin beside upstream's `img-src … blob:`; the Pane
route regex takes upstream's `changes` and the fork's separate resize route; the options type keeps
the fork's required `manualPaneFit` beside upstream's optional `journals`, `cache`, `cacheWatch`,
`folders`. `bridge/crew/forward.ts`: union `|changes|focus|resize`; the audit map keeps the fork's
`pane.focus` / `pane.resize` namespacing while upstream treats `changes` as an unaudited read.
`forward.test.ts`: keep the fork's `paneActionsDeclaredIn` reader, add `changes`, and drop upstream's
side's shadowing `const tab`. `solo-baseline.test.ts`: the union regex. The Herdr adapter, types,
capabilities and state engine auto-merge; upstream has no resize of its own. Verified by the entry's
verify list plus `bash scripts/check-crew-wire.sh` on the staged pair.

### 6. Coordinator decision (a), decided A1: upstream's dashboard footer tabs beside the fork's rails

Facts. Upstream `v1.13` mounts a `TabBar` (Panes / Focus / Changes, ADR 0066) only in
`routes/home.tsx`: an in-flow 56px `nav` after the scroller, with the bottom safe-area inset, not
fixed. The fork's `FleetNavigationFooter` (surface switch + `Herdr Fleet v… · sha` stamp) sits at the
bottom of the left hierarchy rail (and in the drawer), never in the app column; rails show at `xl` and
above. `home.tsx` auto-merges with both the fork's width port and the `TabBar`; `root.tsx`'s one hunk
is imports only (`TourHost` vs the shell). At `xl` the two footers sit level in different columns; the
drawer (fixed, z-40) covers the tabs while open. Focus duplicates what the Agents rail emphasises at
`xl`, harmlessly; below `xl` it is the only attention view. Pinning and hiding a machine are
device-local stores applied only inside the dashboard list; the rails read the snapshot directly.

- **A1 (recommended): coexist.** Resolve the import hunk; adjust upstream's "no sidebar on a wide
  screen" comment only if it misleads; rails ignore dashboard hide/pin/tab (the
  `fleet-native-navigation-sidebars` delta states it). No new invasive path; upstream's footer tests
  and six new e2e specs that locate the tabs stay untouched.
- A2: the fork's footer wins (remove `TabBar`): a new port on `home.tsx`, about nine unit cases and
  six e2e specs to skip, and Changes/Focus lost below `xl`.
- A3: upstream's tabs win (remove the fork's footer): violates `fleet-version-evidence`'s "native
  footer reports the current page build" and loses the on-screen surface switch; needs a spec change.

**Decided (coordinator, 2026-10-01): A1 — coexist.** The `fleet-native-navigation-sidebars` delta
stands as written.

### 7. Coordinator decision (b), decided B1: the record control inside upstream's one-box composer

Facts. In `v1.14.2` the composer is one bordered box: chips, field, attach, then a trailing ternary
(Type anyway / Really send / microphone when `micIsPrimary` / Send). `micIsPrimary = stt && !direct &&
!hasDraft`, and `hasDraft` now also counts attachments — `abdbf45`'s swap, widened. The fork's
separate record control (`size-11`) and its old control row conflict across hunks 5–7; the fork's
Send auto-merged with `!input.trim()`, which would wrongly disable Send on a chips-only draft.
`hasDraft` is read in five other places and must stay. Upstream also removed the composer's status
band (the fork's status-word/host switch has no target and references a deleted `statusWord`), moved
the machine's name to the end of the pane header's path line (the fork additionally draws a
`HostChip` in the app bar's `rightLead` — the name would show twice), and replaced the control row with
the actions belt, whose pills are all icon-plus-word (what the fork's control-rank port did). The
command-bar mic registration, caret splice and focus selector (`textarea[data-slot="chat-input"]`)
all survive.

- **B1 (recommended):** box order field, attach, record, Send; the record control restyled to the
  box's `size-9` round control and drawn whenever the provider condition holds; the `micIsPrimary`
  branch deleted, `hasDraft` kept; Send refuses on `!hasDraft || recorder.busy`. Accept upstream on the
  rest: drop the status band switch and its four props, drop the fork's app-bar `HostChip` (one name,
  on the path line), drop the control-rank constants (the port is retired). Deltas:
  `fleet-composer-voice` (one box; attachments are not blank), `fleet-pane-chrome` (band and host
  chip; rank requirement removed). Cost: about 40px of field width on a 390px phone.
- B2: record control on the belt — rejected: the belt is pane-level and its right end is already
  Switch, Clear/Undo and Changes; upstream defines the box as the controls that act on the draft.
- B3: accept upstream's swap and retire the two-button feature — reverses an owner decision; not
  recommended.

**Decided (coordinator, 2026-10-01): B1.** Box order: input, attachments, record, send. `hasDraft` is
kept; Send is disabled on `!hasDraft || recorder.busy`. Upstream's removal of the composer status-band
toggle and of the duplicate `HostChip` in the app bar is accepted, and the control-level (control-rank)
port is retired. This fulfils the previously deferred "record and send side by side" intent: with the
record control no longer swapped for Send on a non-empty draft, dictation can be repeated into the
same draft. The `fleet-composer-voice` and `fleet-pane-chrome` deltas stand as written.

### 8. Coordinator decision (c), decided C1: pane-surface route and network-first navigation

Facts. `router.tsx` auto-merges: `FleetPaneRoute` still wraps `pane/:paneId`; upstream's new
`pane/:paneId/changes/*` and `space/:spaceId/changes/*` are sibling routes (the pane route has no
children or outlet), so the terminal surface cannot hide them. The router takes
`basename: basePath()` from a `<meta name="collie-base">` the bridge injects, defaulting to `/`; the
Gateway (`fleet/proxy.ts`, `fleet/gateway.ts` public files, `/api` and `/auth` rules) assumes root.
`sw.ts`: hunk 1 imports, hunk 2 the fork's font import vs upstream's in-app open and mount helpers,
hunk 3 the fork's network-first `NavigationRoute` vs upstream's `PRECACHE_MANIFEST` + precache-progress
plugin + precached-shell `NavigationRoute` with a mount denylist. Nothing upstream supersedes
network-first; update mode's single reload is client-driven. `fleet/sw-boundary.test.ts` asserts the
literal `precacheAndRoute(self.__WB_MANIFEST)` after the network-first route and no
`createHandlerBoundToURL`.

- **C1 (recommended):** keep `FleetPaneRoute` unchanged; pin Collie to the root (decision 4 resets
  and guards `COLLIE_BASE_PATH`) rather than teaching the Gateway mounts. In `sw.ts` keep the fork's
  network-first route first, keep upstream's `MOUNT`/`under()` helpers, in-app open and the
  precache-progress plugin, and drop only the precached-shell `NavigationRoute` and its import; the
  fork-owned boundary test is updated to accept upstream's `PRECACHE_MANIFEST` indirection while still
  requiring `__WB_MANIFEST` exactly once, after the network-first route, and no
  `createHandlerBoundToURL`. Upstream's new `update-screen.spec.ts` "reloads once at step 6" is run and
  triaged under `authenticated-navigation-cache` if it meets network-first.
- C2: support a base path through the Gateway — no deployment needs it; a new surface on the public
  boundary; not recommended.

**Decided (coordinator, 2026-10-01): C1.** Collie stays at the root path; the Gateway gains no base-path
support. The service worker stays network-first for navigation; only upstream's precached-shell
`NavigationRoute` is dropped. `fleet/sw-boundary.test.ts` is updated to the `PRECACHE_MANIFEST` form.

### 9. Coordinator decision (d), decided D1: the command bar's anchors

Facts. `useFleetCommandAdapters` is called in `composer.tsx` (type mode, the three mic commands) and
`agent-chat.tsx`; the provider is mounted in the fork-owned shell; `root.tsx` calls none. The recorder,
`stt`, `locked`, `direct` and `sending` stay composer state, so the registrations keep their anchors;
the focus selector still matches upstream's `ChatInput`. Upstream added no global keyboard shortcut
in this range (its tour sheet listens for Escape only while open).

- **D1 (recommended):** keep both registrations where they are; resolve the mic registration (hunk 4)
  by keeping upstream's `hasDraft`/`micIsPrimary` lines' `hasDraft` half beside the fork's
  `runMicCommand`; in `root.tsx` keep upstream's `TourHost` beside the shell. Verify that the first-run
  tour (shown once per device) does not trap the command bar's prefix while open.
- D2: lift the mic registration into a fork-owned wrapper — moves the recorder away from the draft it
  writes into (the entry's own reason); not recommended.

**Decided (coordinator, 2026-10-01): D1 — unchanged.** Verify that the first-use onboarding overlay
(upstream's tour) does not swallow the command bar's prefix while it is open.

### 10. `upstream-removal-clock` shrinks to one clock

At `v1.14.2`, `bridge/removal-schedule.test.ts` is a tombstone with no version clock: it asserts the
overlap modules absent, `legacyStateFileNotice` present, and the old strings absent from 15 named
upstream files (none fork-owned). Its conflict resolves to upstream's file verbatim and the path
leaves the entry. `cli/program.test.ts` keeps `upstreamVersion().major` (the `collie pack` alias stays
until 2.0.0). The entry, its reason and `fleet/upstream-version.test.ts` say one clock.

### 11. `COLLIE_CHANGELOG.md`: no seam

All 77 headings of the retained file are among `v1.14.2`'s 93, the header text is unchanged, and the
retained history below `## [1.8.2]` differs from `v1.14.2`'s in exactly one line: upstream reworded
the `[1.7.0]` bullet "Images from an Oh My Pi or pi agent show up on the phone" in place (a correction
after issue #292, same commits). Nothing was dropped, so the file becomes `v1.14.2`'s changelog
verbatim and no seam is written; the reworded bullet is named here, as the `fleet-upstream-sync` delta
now requires. If the coordinator reads the earlier wording as a dropped entry instead, the file is
`v1.14.2`'s text, then the seam, then that one bullet's earlier wording. **Decided (coordinator,
2026-10-01):** the in-place `[1.7.0]` rewrite is upstream's correction; no seam marker is written.

### 12. Release axis: MINOR, 3.4.0 → 3.5.0

`AGENTS.md`: *"The axis is how far the change has to travel — which machines must redeploy before the
fleet is consistent again."* MINOR: *"every other member redeploys too. Anything a peer executes — the
supervisor, the pack link, the reachability transport, a bridge surface a peer answers on — is half
deployed while one member still runs the old code."* MAJOR: *"the operator changes something that is
not code — a configuration key renamed or removed, a contract broken, an enrolment step, a workflow
that worked and now doesn't."* `fleet-upstream-sync`: an adoption is at least a MINOR, and an agent
that believes the sum is MAJOR stops.

Every member runs a new Collie, so at least MINOR. Not MAJOR on the facts above: the Fleet
configuration is unchanged; the state directory and the config-file posture are projected by Fleet;
no state file is renamed (the trust store's on-disk version is 1 at both tags); enrolment is
unchanged; the census path the deployment polls already moved in 3.4.0; mixed 3.4.0/3.5.0 members both
speak crew protocol 2 above the 1.8.0 floor, so "lead first, member right after" works without a
window of breakage. **Recommendation: 3.5.0.** **Decided (coordinator, 2026-10-01): MINOR,
3.4.0 → 3.5.0**, with the re-assessment conditions below kept.

Re-assess at the release task, and stop for the owner if any of these holds: the coordinator reads
decision 4's refusal as breaking a workflow (it can only fire on a Collie config file no Fleet machine
has); a rollback probe shows 3.4.0 cannot start against state 3.5.0 wrote; or apply finds an operator
step. Were it MAJOR, the parent repository's rule applies — a major must review what the component can
shed — and this change already sheds the overlap fallbacks, the `COLLIE_PACK_*` reset, the second
removal clock and, under B1, the composer band switch, the duplicate host chip and the control-rank
port.

**Re-assessment inputs recorded at phase C (2026-10-01), for task 9.2:** the coordinator ruled that
decision 4's config-file refusal breaks no existing workflow — no Fleet machine has a Collie
`config.toml` — so 3.5.0 stays MINOR on that condition; the rollback probe (task 8.6) passed; and
phase C found no operator step (its fixes are a browser-side navigation fix and test-side ports).

### 13. Archive waits for the members

As before: the push ends this repository's part, but the change is archived only after the operator
reports the lead and the designated member running 3.5.0, lead first.

### 14. Entry review against `v1.14.2` (task group 7)

Every entry's anchors were re-read in the merged tree against `v1.14.2` and its `verify` list run
(the browser-tier files excepted, which stay with 8.3). One path returned to upstream's version
(`bridge/removal-schedule.test.ts`); no entry was dropped. `reviewed = "v1.14.2"` on all 23.

| entry | decision | reason |
| --- | --- | --- |
| `native-row-actions-menu-port` | keep | strips still change by one drop-in each; `tab-strip.tsx`'s "+" and hold press sit beside it |
| `unnarrowed-pack-rows-port` | keep | loaders auto-merged; reason now says the previous path's redirect is gone since 1.9 |
| `repository-guidance` | keep | symlink contract unchanged; the overlap sentence was corrected in group 6 |
| `fake-network-fleet-routes` | keep | Fleet routes beside upstream's new handlers |
| `lint-parse-boundary` | keep | one override class, no rule changed |
| `plugin-identity` | keep | identity, actions and build steps still read only from the manifest |
| `downstream-version-line` | keep | `sugar-high` is upstream's and adds no fork diff to `web/package.json` |
| `fleet-build-port` | keep | `./fleet` in upstream's scripts beside `build:cli` |
| `native-agent-favorites-port` | adapt | favorites lead workspace groups beside pins, hidden machines and chips; the `ATTENTION` re-export is gone |
| `pane-surface-route-port` | keep | wrap unchanged; Changes routes are siblings; its fork-owned route test now reads the name and place from the identity block, since upstream overlays an empty button on it and line 2 is the place |
| `native-pane-content-port` | keep | `renderContent` beside upstream's view-transition work |
| `authenticated-navigation-cache` | adapt | decision 8; both e2e skips still meet the same premise in 1.14's suite (confirmation in 8.3) |
| `native-manual-pane-fit-port` | adapt | decision 5 union with `changes`/`isPaneReadAction`; overlap wording removed; band, rank and host-chip parts retired; record control inside the box |
| `declined-centred-history-column` | keep | owner decision stands |
| `native-navigation-sidebars-port` | adapt | decision 6 (footer tabs coexist, rails ignore hide/pin/tab), belt handle at the rail breakpoint, `ATTENTION` from triage, inline section headers |
| `native-pane-chrome-port` | adapt | decision 7: strips badge and mark ground kept; rank intent and band/dock parts retired |
| `native-webfont-port` | keep | CSP origin beside upstream's `blob:` |
| `private-fact-guard-port` | keep | the hook is untouched upstream between the two tags |
| `composer-voice-rank-port` | adapt | decision 7; upstream's swap now counts attachments |
| `fork-gate-in-ci` | keep | one step plus fetch-depth beside upstream's WebKit job |
| `no-automatic-release-publication` | keep | `release.yml` still on `workflow_dispatch` only; no tag-push trigger came back |
| `upstream-removal-clock` | adapt | decision 10: one clock, `cli/program.test.ts`; `removal-schedule.test.ts` is upstream's verbatim |
| `downstream-docs` | keep | upstream's newer docs pages join the registry; the one exclusion is unchanged |

Phase C2 re-review (task 7.4): the removal clock is one; the docs-registry exclusion still applies
beside upstream's new page; the root-test, motion and smoke scopes still apply (the rails still list
the rows those queries find) and their tests pass locally except the smoke spec (browser tier, 8.3);
both network-first e2e skips stay, pending 8.3's run.

Boundary check after the review: `bun scripts/check-fork.ts` reports 617 owned and 84 invasive paths,
no unclassified path, no stale anchor, no lagging entry; the retention check passes and
`COLLIE_CHANGELOG.md` is byte-identical to `v1.14.2`'s `CHANGELOG.md`.

## Risks / Trade-offs

- [The state-directory change hides in an auto-merge] → decision 3 is a mandatory task with a test
  through upstream's resolver; the release is not cut until a member proves Collie opened the same
  trust store (its crew mode and member id unchanged).
- [Upstream's in-app update now has a full-screen update mode] → it offers upstream's releases, as the
  update banner already did; Fleet does not level members that way. Unchanged posture, noted for the
  operator.
- [Full suites and known nondeterminism] → run on a designated member; triage against the pre-merge
  baseline; the web-suite exit nondeterminism and the STT test hangs stay with their own changes.
- [Upstream's browser tier asserts upstream's layout] → new specs run at phone size where the rails
  are hidden; a failure inside a declared port is fixed in the port or declared; WebKit runs where the
  host supports it.
- [A config-file refusal surprises an operator later] → the message names file and setting and says
  Fleet owns it; `docs/herdr-fleet.md` lists the owned settings.

## Migration Plan

For the operator's deployment side, which owns it (nothing here is done by this change):

1. Level the lead to 3.5.0, then the designated member right after. Both speak crew protocol 2, so
   the order is not a correctness window, but the member shows as outdated in version evidence until
   it is levelled.
2. The deployment build stays `bun run build` in a clean checkout with its tags fetched; it now also
   installs `sugar-high`. `bin/` must be a real directory (it is, in a fresh clone).
3. No Fleet configuration edit, no enrolment step, no state rename. Do not create a Collie
   `config.toml` that sets a Fleet-owned setting (listed in `docs/herdr-fleet.md`).
4. Rollback to 3.4.0 needs no file renames; verify once that a 3.4.0 Collie starts against state 3.5.0
   wrote (task 8.6) before relying on it.
5. Member proof: each member in the lead's crew census at 3.5.0 with a fresh receipt; Collie's crew
   mode and member id unchanged from before the upgrade; a manual fit on a member Pane still resizes it.

## Release

Cut as `3.5.0` (MINOR, from `3.4.0`; the remote's newest tag was still `v3.4.0`) in one
`chore(release): 3.5.0` commit, tagged `v3.5.0` and pushed with the tag named on the push line. No
GitHub Release is published. Decision 12's re-assessment held: the coordinator ruled MINOR and that
the config-file refusal breaks no existing workflow, the rollback probe (8.6) passed, and no operator
step appeared. The `3.5.0` changelog section says, in the operator's words: the lead and every member
run 3.5.0 or later, because Collie 1.9 removed the 1.7/1.8 wire overlaps; Collie's state directory is
now projected as `COLLIE_STATE_DIR` and nothing moves on disk; a Collie `config.toml` setting a
Fleet-owned key refuses start; a trust directory holding only `pack-*.json` is refused; `/api/pack` is
gone and tooling reads `/api/crew`; no operator configuration changes are required.

Hand-off: deploy the lead first, then each member, following the Migration Plan above. Rolling back
to 3.4.0 is a plain redeploy, with no file renames — 8.6 proved a 3.4.0 Collie starts against state
3.5.0 wrote. The push is not a completed adoption: this change stays active until the operator
reports the lead and the designated member on 3.5.0, lead first (decision 13); task 10.2 archives it
then.
