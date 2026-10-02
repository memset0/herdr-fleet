## Context

See proposal.md — Why. The ground as read before anything was changed (all read-only, in a scratch
clone made with `git clone --shared`, where the merge was also rehearsed and thrown away):

```
baseline  v1.14.2  tag 52711167…  commit 887a37db…   (FORK.toml [upstream]; = merge-base main v1.15.0)
target    v1.15.0  tag 1dba7de3…  commit ef01b0ed…   81 commits, 257 files, released 2026-10-01
preflight (bun scripts/check-fork.ts --target v1.15.0 --allow-active-changes, before this change existed):
          19 of 25 invasive entries disturbed; 6 untouched (native-row-actions-menu-port,
          native-pane-content-port, no-automatic-release-publication, upstream-removal-clock,
          downstream-docs, claude-manage-hint-port); no declared path renamed; no owned path occupied
```

`git merge-tree --write-tree --name-only main v1.15.0` predicts 16 conflicted paths and 25 hunks plus
one type conflict, every one inside a declared entry:

| entry | conflicted paths (hunks) | cause upstream |
| --- | --- | --- |
| `repository-guidance` | `CLAUDE.md` (distinct types) | upstream's agreement gained the release-needs-something rule, the integration lane, two Vitest projects, the Settings index routes and push-title translation |
| `downstream-version-line` | `CHANGELOG.md` (1), `web/package.json` (1) | the 1.15.0 section; the version line |
| `plugin-identity` | `herdr-plugin.toml` (1) | the version line |
| `fleet-build-port` | `package.json` (1) | the version line (`test:crew` moved to `integration/` and auto-merged) |
| `native-manual-pane-fit-port` | `bridge/server.ts` (1), `bridge/crew/forward.ts` (2), `bridge/crew/forward.test.ts` (1), `bridge/solo-baseline.test.ts` (1) | the live session window: a `chat` pane read, forwarded across the crew link (`c75ced6e`, CREW_PROTOCOL additive) |
| `native-manual-pane-fit-port` | `web/src/components/agent-chat.tsx` (3), `composer.tsx` (3), `composer.test.tsx` (1), `display-prefs.tsx` (3) | Copy output in the pane menu (`d5057d23`), the Display panel moved from the composer into a sheet the Pane page mounts (`71c096dc`) and its rows answering for the body on screen, Text size first (`299fc465`), the Chat body (`2e46ea22`) |
| `native-navigation-sidebars-port` | `web/src/routes/settings.tsx` (3) | Settings as an index of four sections plus Experiments (`7527b53e`) |
| `authenticated-navigation-cache` | `web/src/sw.ts` (1) | push titles translated in the worker (`ffd600cb`, #310) |
| `codex-headless-status-row-port` | `web/src/lib/harness/codex/markers.ts` (1) | the goal notice's painted padding (`ed647185`, #317) |

Clean auto-merges that still matter: `bridge/index.ts`, `bridge/types.ts`, `CREW_PROTOCOL.md`,
`web/src/lib/{api,types,loaders}.ts`, `web/src/router.tsx` (the section routes and the pair landing
beside `FleetPaneRoute`), `web/src/routes/history.tsx`, `web/src/test/handlers.ts`, `.oxlintrc.json`,
`web/src/hooks/use-display-prefs.ts`, `web/src/components/collie-home.tsx`,
`web/src/components/agent-chat.test.tsx`, `web/src/components/composer-stt.test.tsx`,
`docs/voice-and-push.md`, `scripts/git-hooks/pre-commit` (guard E untouched; upstream widened guard
A's test-only filter), `.github/workflows/ci.yml` (the fork gate and fetch depth kept beside a new
integration job), and the seven dictionaries. Upstream renamed three of its own test files
(`bridge/crew/harness.test.ts` → `integration/crew-harness.test.ts`, two omp tests into
`web/src/lib/send/`); none is declared. Upstream added `web/src/components/settings-page.tsx`, the
shell every Settings section wears, with the same reading-column cap the index had.

What `v1.15.0` requires of an operator, read from the changelog and the source:

- **Configuration and environment.** One new Collie setting, `mux_endpoint_tuios` /
  `COLLIE_MUX_ENDPOINT_TUIOS`, and one new value of an existing one: `COLLIE_MUX=tuios` (the `mux`
  key's doc now names four multiplexers). Neither is Fleet-owned (decision 7). No setting is renamed or
  removed; `FLEET_OWNED_COLLIE_SETTINGS` needs no change.
- **State.** No state file is added, moved or renamed. Chat's standing choice, its text size, the tool
  call fold, the pane order and the experiment switch are browser-local preferences.
- **Routes.** `GET /api/pane/:id/chat` (the live session window, a read on the poll path) and its crew
  twin `/crew/v1/pane/:id/chat`, additive inside crew protocol 2; a member one release behind answers
  404, which the phone reads as "update this member". `/settings` is an index; `/settings/{appearance,
  device,alerts,system,experiments}` are new; `/settings?pair=` forwards to System. The Gateway proxies
  every `/api/*` path behind the session already and needs no rule.
- **Crew link.** Device ids outside ASCII travel percent-encoded (RFC 8187), additive; protocol 2 and
  the 1.8.0 floor are unchanged, so a 3.5.x member and a 3.6.0 lead interoperate.
- **Push.** The bridge sends a title code beside the English title; the page leaves its language's
  templates in Cache Storage and the worker fills them in. The fork's network-first navigation does not
  touch Cache Storage, so the table survives.
- **Runtime.** No dependency change in either package manifest; `MIN_BUN` and `min_herdr_version`
  unchanged.

**Answer: no operator configuration changes.** Every member redeploys because the bridge changed.

## Goals / Non-Goals

**Goals:**

- `v1.15.0` in this history as real ancestry, every port reviewed against it, the Codex port layered on
  upstream's #317 reading exactly as the owner's upstream pull request layers it.
- The four product trade-offs decided at the 1.14.2 adoption (A1 coexisting tabs, B1 composer order,
  C1 root path and network-first worker, D1 command bar) kept unchanged across this release.
- Upstream's new Pane surfaces (Chat, the Display sheet, Copy output) and Settings index meet the
  fork's ports explicitly, not by whichever side of a conflict was easier to keep.

**Non-Goals:** as in proposal.md.

## Decisions

### 1. Preflight, planning commit and the merge, as in the previous adoption

This change's planning artifacts are committed on their own, planning-only, before the preflight
runs, because the preflight refuses untracked paths. Once committed, this change is itself an active
change, so the preflight runs with `--allow-active-changes`. **Authorized by the owner for this
adoption (coordinator, 2026-10-01).**

`git merge --no-ff --no-commit 'v1.15.0^{commit}'`; verify `MERGE_HEAD` is
`ef01b0ed4d9271897413984075aa6d2060ffcf2a`; resolve; commit the merge with `git commit -F` and no
pathspec (the merge exception). Contracts: `CLAUDE.md` stays the relative symlink and no
`CLAUDE.md~…` survives (upstream's agreement is not read into `AGENTS.md`, as at every earlier
adoption); `CHANGELOG.md` stays ours with one bold-lead Unreleased line; version files keep `3.5.3`;
`herdr-plugin.toml` keeps this product's identity; `COLLIE_CHANGELOG.md` becomes `v1.15.0`'s changelog
verbatim (decision 9). The merge commit records the merge and its conflict resolution only; the
fork-side migration follows as its own commit, then the port review. The merge commit knowingly fails
the root typecheck on one line (decision 2) until the migration commit.

#### Phase A record (2026-10-01)

- Baseline before the change: hooks active (`core.hooksPath` = `scripts/git-hooks`); `main` level with
  `origin/main` at `16f04a11` (v3.5.3); `bun run test:fork` 20 pass and the boundary check clean
  (653 owned, 95 invasive paths); `bun test ./fleet` 598 pass, 0 fail.
- Planning commit `bfad2a1d`. Preflight `check-fork.ts --target v1.15.0 --allow-active-changes`
  (authorization above), output kept in the session scratchpad: tag object
  `1dba7de34afa9334a185f85e8f1d1947f4f723c3`, commit `ef01b0ed4d9271897413984075aa6d2060ffcf2a`, 19
  disturbed, 6 untouched, no moved declared path, no owned path occupied, this change listed as
  authorized. `merge-tree` and the opened merge both gave the 16 predicted paths.
- Merge commit `da8bdeb4` (parents `bfad2a1d`, `ef01b0ed`), committed with every pre-commit guard
  armed (no hatch was needed this time). `bun install` changed neither lockfile. Version files 3.5.3,
  `check-version.sh` ✓, `COLLIE_CHANGELOG.md` `cmp`-clean against `v1.15.0`'s changelog, `CLAUDE.md`
  the symlink. The merge's root typecheck fails only on the helper's nullable return (decision 2).

#### Phase B record (2026-10-01)

- Migration commit `f23db661` (`feat(web)`, one `CHANGELOG.md` line): the helper's non-null signature
  and its new case, the Chat gate with two new fork cases (the terminal-surface case fails with the gate
  removed, checked in the rehearsal), the Display sheet's Close control in the fork's manual-fit cases,
  the uncapped section shell, the scoped index test, the 1.15.0 credit case and `tuios: false`,
  `docs/herdr-fleet.md` (Resize in the terminal view's Display sheet; Settings → Alerts), and the
  `FORK.toml` path and anchor moves.
- Review commit `c638497d`: `[upstream]` → `v1.15.0`, 25 entries at `reviewed = "v1.15.0"`, the
  `UPSTREAM.md` row. Its message says seven entries were adapted; the table in decision 12 is the
  record, and it lists six (the commit is not amended).
- Results: both typechecks clean; full-tree `oxlint` clean; `bun run test:fork` clean (661 owned, 96
  invasive); `check-private-facts` ✓; `check-version.sh` ✓; every bun `verify` file across all entries
  passes file by file (57 files), as do `scripts/check-tag.test.sh` and `scripts/pre-commit.test.sh`;
  `bun test ./fleet` 598 / 0; web vitest over every entry's `verify` file plus the touched components
  and the whole harness tree: 88 files, 10488 pass, 32 expected fail, 47 todo, 0 fail.

#### Phase C record (2026-10-01, task group 6)

Two commits on `main`, both `fix(gateway)` in fork-owned `fleet/gateway.ts` and its test, one
`CHANGELOG.md` line between them: `1b98cf6c` puts the boot splash's two header marks on the Gateway's
exact public list, and `b73c7b96` takes the gallop sprite off it, correcting the first commit's reading
that the app still drew the sprite (decision 7, revised). No other fix was needed; nothing was pushed,
tagged or bumped.

- **Local (6.1, 6.5).** Both typechecks and `bun run lint` clean; `bun run test:fork` 20 / 0 and the
  boundary check clean (676 owned, 96 invasive paths, no unclassified path); `check-private-facts`,
  `check-version.sh` and `check-crew-wire.sh` (nothing staged) pass; the four hook suites (`check-tag`,
  `pre-commit`, `check-flake-lock`, `check-payload-links`) pass; `bun test ./fleet` 599 / 0 at both fix
  commits; all 28 `bridge/crew/*.test.ts` files and `integration/crew-harness.test.ts` (`test:crew`) pass
  file by file, 1174 / 0; `cli/*.test.ts` file by file, 41 files, 1606 pass and the one environmental
  failure known from the previous adoption (`cli/tools.test.ts` finds this host's own `herdr`; it passes
  on the designated member); `scripts/release-notes.test.ts` 41 / 0; full web vitest 320 files, 13917
  pass, 32 expected fail, 47 todo, 0 fail.
- **Designated member (6.1).** Tree brought to `1b98cf6c` by an incremental bundle, then to `b73c7b96`;
  `bun install` changed nothing. `bun test ./bridge` file by file: 128 files, 3870 pass, 5 fail, 2 timed
  out. The five failures are upstream 1.15's new long-session journal cases (`hermes`, `opencode`),
  whose sqlite fixtures time out at the 5 s default when the private temporary directory sits on the
  host's network-mounted home; with it on local disk both files pass (17 / 0, 118 / 0), so 3875 / 0. The
  two timeouts are `bridge/stt/codex` and `bridge/stt/openai`, the known hangs. `bun test ./cli` file by
  file 43 files, 1622 / 0; `bun test ./fleet` 599 / 0 (and again at `b73c7b96`); `bun test ./scripts`
  229 / 0; `bun run test:crew` 63 / 0; all nine shell suites, both typechecks and lint pass; web vitest
  320 files, 13917 pass, 32 expected fail, 47 todo, 0 fail. Tree left clean.
- **Browser tier (6.2).** `cd web && bun run e2e` (Chromium): 167 passed, 0 failed, 99 skipped on the
  first run, so no case needed settling at this adoption. `pair-landing.spec.ts` (all three cases) and
  `m24-crew.spec.ts` (all six, now through `/settings/system`) pass on both app projects. The phone
  project's 11 skips are exactly the ones already declared at 3.5.0 (two network-first
  `service-worker` cases, `back-goes-up` D and the slide case, four `pane-glide` back-arrow cases,
  `pinned-panes` switcher, upstream's WebKit-only `update-screen` variant, `filter-strip`'s own skip);
  the tablet project's 88 are upstream's phone-only cases plus the two declared `codex-padding` tablet
  skips. The six new passes against 3.5.0's 161 are `pair-landing` on both projects.
- **UI check (6.3)** over CDP on a scratch build with a synthetic mock, 1600/1440/1280/390, dark and
  light: the terminal view's Display sheet has Text size then Resize (badge "Custom") then Collie's
  rows; the Chat view's sheet has View, Text size and Tool calls and no Resize; the pane menu offers Copy
  output (mirror and Chat), Chat offers "Terminal view", and under the terminal surface with Chat the
  standing choice there is no Chat switch, no session text, no Copy output and no Display sheet (the
  surface replaces the body and composer); the Settings index has the Fleet group above the section rows
  at the column's full width (32px of padding at every width) and its sections fill the column too; the
  two widened Claude mode-line screens (w120, w93) draw no dialog card and leave the composer open;
  "Mark all seen" shows its count, sends the seen read for the unseen pane and disappears, in the rail
  at 1600 and in the phone's switcher sheet; rail rows 44px at 16px/500 and the footer build row level
  with the tab bar (0/844/280/56 at 1440, 0/744/220/56 at 1280), as measured at 3.5.2. With the bundle
  blocked the boot splash paints the dark or light mark (200, `image/svg+xml`).
- **Rollback probe (6.4) — pass.** In scratch directories, a lead minted an invite and a peer enrolled
  through Fleet's own enrolment against it, both with this change's code, and came up as `lead` and
  `peer`. Then `16f04a11`'s tree (3.5.3, from `git archive`) was started against the same directories:
  `lead` and `peer` again, the same crew id and member ids, the peer reachable; a 3.5.3 lead with this
  change's peer was also reachable across versions. Both trees' `validatePackAuthority` accept both
  directories; the trust stores were byte-identical before and after the 3.5.3 run and no file was
  renamed (only `crew-runtime.json` was refreshed). No deployed instance was touched.
- **Public-tree audit (6.5).** The private-fact guard passes; this change's first-parent commits and
  artifacts name no host, address, path, credential, mesh or parent tooling; `check-fork.ts` reports no
  unclassified path.

Resolutions, by conflicted path:

| path | resolution |
| --- | --- |
| `bridge/server.ts`, `bridge/crew/forward.ts`, `forward.test.ts`, `bridge/solo-baseline.test.ts` | union: upstream's `chat` joins the pane route, the forwardable grammar, the audit map's reads and the route inventory beside the fork's separate `resize` route and its `pane.focus`/`pane.resize` namespacing |
| `web/src/components/composer.tsx`, `composer.test.tsx` | upstream's: the composer keeps only the gear and a `display` toggle; its seven Display props and the fork's `displayPrefsAfterTextSize` hole go, and the test file is upstream's verbatim (its one fork line asserted the badge was absent from the old dock) |
| `web/src/components/display-prefs.tsx` | upstream's body-aware rows with the fork's optional `afterTextSize` slot kept, now directly after the terminal body's Text size row (decision 3) |
| `web/src/components/agent-chat.tsx` | both: the fork's body-swap effect beside upstream's `copyOutput`; upstream's `display` toggle on the composer, and the fork's Resize row passed to the sheet's `DisplayPrefsContent` as `afterTextSize`; Find gated `hasOutput && !chatBody` (the fork's terminal-aware `hasOutput` and upstream's Chat exclusion) |
| `web/src/routes/settings.tsx` | upstream's index with the fork's group at its head and the cap and header claim removed (decision 5) |
| `web/src/sw.ts` | upstream's `readPushTitles` import beside `FONT_URLS`; `navigationNetworkOnlyUnder` stays dropped with the precached-shell route it served |
| `web/src/lib/harness/codex/markers.ts` | upstream's `folded` / `splitPaintedGaps`, the fork's normaliser applied to its result (decision 2) |
| `CHANGELOG.md`, `package.json`, `web/package.json`, `herdr-plugin.toml`, `CLAUDE.md` | ours, plus one Unreleased line |

### 2. The Codex headless status-row port is layered on #317

Upstream's `splitPaintedGaps` cuts a painted field's run of two or more trailing spaces into the field
and an unstyled gap, which is how a goal notice's padding arrives. The fork's
`withFleetCodexStatusSegments` repairs a different repaint: one trailing space before `· `, and an
already-unpainted gap glued to the notice glyph. Neither regex matches the other's segments, so the
order does not change any reading; the owner's upstream pull request (`fix/codex-headless-status-row`,
`2b7ba0fa`, rebased on upstream's main) runs its `regroupStatusSegments` after `splitPaintedGaps`, and
the fork mirrors that:

```ts
const folded = foldTrailingPadding(line.segments);
if (folded === null) return false;
const segments = withFleetCodexStatusSegments(splitPaintedGaps(folded));
```

The helper stays fork-owned. Its signature narrows to a non-null list (its `null` pass-through only
existed to accept `foldTrailingPadding`'s result directly), and its suite gains a case that a
field-and-gap pair cut by upstream passes through unchanged. The anchor becomes
`withFleetCodexStatusSegments(splitPaintedGaps(folded))`; the notice-paint part of the port
(`isRightNotice`'s parameter and `fleetReadsUnpaintedNotice`) auto-merged untouched. Verified in the
rehearsal: all 47 `web/src/lib/harness` files pass (9480 tests), including upstream's new
`codex--v0158-goal-notice.txt` cases, the Codex 0.159.2 ledger, the fork's two headless fixtures and
`invariants.test.ts` with the known-gap entry still removed. Upstream reads the goal padding and still
not the headless multi-item row, so the port stays temporary and is not retired at this sync.

The Claude manage-hint port is untouched by the release (upstream's ledger verifies Claude Code
2.1.285, one below the 2.1.286 hint), and stays.

### 3. Manual Pane fit follows Collie's Display sheet

Collie 1.15 moved the belt's Display panel out of the composer into a `BottomSheet` the Pane page
mounts, and made its rows answer for the body on screen: the terminal body shows Text size first, then
wrap, tap-to-type, full reply, raw terminal and no-invert; the Chat body shows its own text size and
the tool-call fold. The fork's Resize row is therefore handed by the Pane page straight to the sheet
(`afterTextSize`), among the terminal body's rows directly below Text size — which keeps "immediately
below Text size" true — and is not drawn among Chat's rows, because Resize fits the PTY to the mirror
and Chat draws no mirror. The composer's Display props and hole are gone, shrinking
`native-manual-pane-fit-port` by `composer.test.tsx`; the composer's remaining ports (the command
registrations and the record control) are anchored on `useFleetCommandAdapters`. The fork's
`agent-chat.test.tsx` cases close the sheet by its own Close control, and gain one case: Chat's rows
carry no Resize.

### 4. The terminal surface replaces Collie's Chat body too

The fork's `renderContent` port already replaces the Pane's whole body, so with the terminal surface
selected Collie's Chat body could never draw — but without a gate Collie would still offer its Chat
switch, describe the sheet as "showing chat", and poll the live session window it never shows. One
port line on the Pane page: `const chatOffered = renderContent === undefined &&
dash.prefs.chatExperiment;`, so every Chat decision downstream of it (the ⋮ row, the sheet's switch,
the window's poll) stands down while the terminal surface is drawn, and Collie's stored choice is left
alone for when the mirror is selected again. Alternatives rejected: gating `chatBody` alone (leaves the
switch offered over a surface it cannot change); a fork wrapper around the Chat hooks (moves upstream
logic out of its file for one boolean). The fork's `fleet-pane-terminal` delta states it; a new fork
case renders a content renderer with Chat chosen and asserts no switch, no session text and no
`chat` read — and fails when the gate is removed (checked).

Copy output needs nothing: it copies the mirror's buffered text and hides without it, and the terminal
surface loads no mirror text. Zen keeps the fork's `hasOutput` gate. The fork's pointer context menu
(`fleet-row-actions`) draws the strip pills' actions, where upstream offers neither Copy output nor the
Chat switch (both are header-menu rows), so it gains no row.

### 5. Settings is an index; the fork group heads it

Upstream split Settings into an index of four sections (Appearance, Device, Alerts, System) plus
Experiments, with every card moved into `web/src/routes/settings-sections.tsx` and a shared section
shell. `fleet-settings` requires the Fleet group first on the Settings page with Collie's settings
following unchanged, so the group stays at the head of the index, above the section rows; no section
gains a fork card and the CJK fallback card stays inside the group. `fleet-native-navigation-sidebars`
requires no Settings page to cap itself, so `settings-page.tsx` loses `mx-auto … max-w-screen-sm` and
its `width="column"` claim exactly as the index does (one new invasive path). Upstream's index test
"renders no setting of its own" counts only the controls outside the fork's group, which stands there
by design (one test port). Alternatives rejected: a fifth "Herdr Fleet" section (edits the router, the
nav section type and the index rows — three invasive paths to move a group the spec places at the
head); folding the group into Appearance (mixes installation-wide Fleet settings into a page upstream
argues card by card).

`/settings/updates`, already capped in 1.14.2 and not reached from any Fleet workflow, is left as
upstream's and noted for a later change.

### 6. Upstream tests that meet a port

Settled at the boundary as in the previous two adoptions — scope a query, adapt a locator, or read
Collie's changelog — never weakening an assertion about upstream's own surface:

| case | met | settled |
| --- | --- | --- |
| `scripts/release-notes.test.ts` 1.15.0 credits | `downstream-version-line` | reads `COLLIE_CHANGELOG.md`, like the 1.12.x credit cases |
| `web/src/routes/settings.test.tsx` "renders no setting of its own" | `native-navigation-sidebars-port` | counts controls outside the fork's group |
| `fleet/manual-pane-fit/capability.test.ts` (fork-owned) | the new tuios adapter | expects `tuios: false` |
| `web/src/components/agent-chat.test.tsx` fork cases | `native-manual-pane-fit-port` | close the Display sheet by its Close control |

Upstream's switcher tests and its new `display-prefs`, `pane-actions-sheet`, `pane-order-control`,
`session-stream` and `settings-experiments` suites pass unchanged. The browser tier is phase C's
(`pair-landing.spec.ts` and `m24-crew.spec.ts` now open `/settings/system`).

### 7. The pane switcher's orders, `COLLIE_MUX`, and the boot-splash marks

- **Switcher orders.** Collie's Place / Activity / cache toggle orders upstream's switcher sections.
  Under the Fleet shell the switcher sheet holds the Agents rail, so the toggle is not drawn, and the
  Settings → Appearance → Pane order row writes a value only upstream's switcher reads. Like a hidden
  machine or a dashboard tab, the order is a choice the rails do not follow; the sidebars delta says so
  and also corrects the requirement's stale "a pane it pins" clause, which the 3.5.2 Pinned group had
  already overtaken. Teaching the rail the orders is not part of an adoption.
- **`COLLIE_MUX`.** Not Fleet-owned, before or after: Fleet runs as a Herdr plugin and has never reset
  or set the multiplexer, which already accepted tmux and zellij. `tuios` is a new value of that key
  and `COLLIE_MUX_ENDPOINT_TUIOS` a new endpoint beside the existing ones; manual Pane fit stays
  Herdr-only because the tuios adapter advertises no `resizePane`.
- **Boot splash.** `index.html` now draws `/collie-mark-header-{light,dark}.svg`. **Revised in phase C:**
  the Gateway's public list gains both exact paths and drops the gallop sprite. The list held the
  splash's artwork — the sprite, public since the Gateway was written because the splash paints it
  before the app has asked for anything — and the marks take the sprite's place in the splash; behind
  the session they were answered `no-store`, so every boot fetched them again. No page draws the
  sprite any more (upstream's `<DogGallop/>` is mounted nowhere), so it leaves the list, as the lean
  rule asks; it is still served behind the session. Both marks carry no protected data and the rule
  stays an exact-path allowlist (no pattern, no source map). Fork-owned edits only (`fleet/gateway.ts`
  and its test), one `CHANGELOG.md` line; the first paint is checked on the lead after deploy. (The
  first commit kept the sprite on a wrong reading that the app still drew it; the follow-up corrects
  it.)

### 8. Repository guidance

Upstream's `CLAUDE.md` changed (decision 1's table). As at every earlier adoption, `AGENTS.md` is this
product's own agreement and is not synchronised with upstream's; nothing in the change contradicts a
rule of ours. The integration lane matters to phase C only (`bun run test:crew` now runs
`integration/crew-harness.test.ts`).

### 9. `COLLIE_CHANGELOG.md`: no seam

`v1.15.0`'s changelog is `v1.14.2`'s header, the new `## [1.15.0]` section, then `v1.14.2`'s file from
`## [1.14.2]` down byte for byte: nothing dropped and nothing reworded. The file becomes `v1.15.0`'s
changelog verbatim and no seam is written.

### 10. Release axis: MINOR, 3.5.3 → 3.6.0

An adoption is at least MINOR (`fleet-upstream-sync`), and every member executes the new bridge.
Not MAJOR: no Fleet configuration key, enrolment step, state file or contract changes; crew protocol
stays 2 with additive reads; mixed 3.5.x/3.6.0 members interoperate. **Decided (owner): 3.6.0.** The
release is cut in phase C after the full gates; read the remote's newest tag first.

### 11. Archive waits for the members

As before: the push ends this repository's part, and the change is archived only after the operator
reports the lead and the remaining member running 3.6.0, lead first.

### 12. Entry review against `v1.15.0` (task group 5)

Every entry's anchors were re-read in the merged tree against `v1.15.0` and its `verify` list run (the
browser-tier files excepted, which stay with phase C). One path returned to upstream's version
(`web/src/components/composer.test.tsx`), two joined (`web/src/components/settings-page.tsx`,
`web/src/routes/settings.test.tsx`); no entry was dropped. `reviewed = "v1.15.0"` on all 25.

| entry | decision | reason |
| --- | --- | --- |
| `native-row-actions-menu-port` | keep | strips untouched; the sheet's new header-only rows (Copy output, the Chat switch) are never offered on a strip pill |
| `unnarrowed-pack-rows-port` | keep | loaders auto-merged beside upstream's chat-window additions |
| `repository-guidance` | keep | symlink contract held; upstream's agreement changes not imported (decision 8) |
| `fake-network-fleet-routes` | keep | Fleet's 404 beside upstream's new chat-window handlers |
| `lint-parse-boundary` | keep | upstream's tuios client joined the same override; the fork's five files unchanged |
| `plugin-identity` | keep | identity, actions and build steps still read only from the manifest |
| `downstream-version-line` | adapt | the 1.15.0 credit case reads `COLLIE_CHANGELOG.md` (decision 6) |
| `fleet-build-port` | keep | `./fleet` in the test script beside upstream's moved `test:crew` |
| `native-agent-favorites-port` | keep | dictionaries carry upstream's new keys beside the fork's |
| `pane-surface-route-port` | adapt | route wrap unchanged beside the new Settings routes; Chat gated off under the terminal surface (decision 4, carried on `agent-chat.tsx`) |
| `native-pane-content-port` | keep | `renderContent` untouched; it now also replaces the Chat body |
| `authenticated-navigation-cache` | adapt | push-title import beside the font import; network-first unchanged, both e2e skips stay pending phase C |
| `native-manual-pane-fit-port` | adapt | `chat` joins the route union; Resize in the Display sheet's terminal rows (decision 3); composer port shrinks to its registrations and record control; composer test returns to upstream |
| `declined-centred-history-column` | keep | history gained the abandoned-branch filter, no width claim |
| `native-navigation-sidebars-port` | adapt | fork group heads the Settings index; section shell uncapped; index test scoped; switcher orders not followed by the rails (decisions 5, 7) |
| `native-pane-chrome-port` | keep | `paper` port intact beside upstream's agent-start bloom |
| `native-webfont-port` | keep | `maple` anchors intact beside Chat's own font size |
| `private-fact-guard-port` | keep | upstream widened guard A's test-only filter; guard E and the lint skip line untouched |
| `composer-voice-rank-port` | keep | the record-control cases auto-merged and pass; docs moved to Settings → Alerts upstream |
| `fork-gate-in-ci` | keep | one step plus fetch depth beside upstream's new integration job |
| `no-automatic-release-publication` | keep | `release.yml` untouched; still `workflow_dispatch` only |
| `upstream-removal-clock` | keep | reads `v1.15.0` now; the `collie pack` alias stays until 2.0.0 |
| `downstream-docs` | keep | upstream's two new docs pages join the registry; the one exclusion unchanged |
| `claude-manage-hint-port` | keep | upstream verifies Claude Code 2.1.285 and does not read the 2.1.286 hint |
| `codex-headless-status-row-port` | adapt | layered on `splitPaintedGaps` (decision 2); still temporary |

Boundary check after the review: `bun scripts/check-fork.ts` reports 661 owned and 96 invasive paths,
no unclassified path, no stale anchor, no lagging entry; the retention check passes and
`COLLIE_CHANGELOG.md` is byte-identical to `v1.15.0`'s `CHANGELOG.md`.

## Risks / Trade-offs

- [The Chat body is an upstream experiment that may change shape in a patch] → the fork touches it
  through one boolean and one slot; a later sync re-reads both.
- [Pane order row inert under the shell] → recorded (decision 7); no data is lost and upstream's
  switcher still honours it wherever upstream's sheet is drawn.
- [Browser-tier cases new in 1.15 meet the rails or Settings index] → phase C runs them and settles
  each in a declared port.
- [Merge commit does not typecheck] → one line, fixed by the next commit; nothing is pushed between.

## Migration Plan

For the operator's deployment side (nothing here is done by this change): level the lead to 3.6.0
first, then the remaining member; no configuration edit, no enrolment step, no state rename; rollback
to 3.5.x is a plain redeploy (protocol 2 on both sides). Member proof: in the lead's census at 3.6.0
with a fresh receipt; a manual fit on a member Pane still resizes it; a member Pane's Chat body (when
opted in) reads through the lead.

## What phase C must verify

Full suites on the designated member (root `bun run test`, web vitest, `bun test ./cli`, scripts and
shell suites, `bun run test:crew`); the browser tier (`cd web && bun run e2e`), settling any case that
meets the rails, the Settings index or the Display sheet; a UI check of the Display sheet (Resize below
Text size on the mirror, absent on Chat), the Settings index with the Fleet group at its head and full
width, Chat under the mirror and its absence under the terminal surface, Copy output, the boot splash
marks; a rollback probe of a 3.5.3 Collie against state 3.6.0 wrote; the public-tree audit; then the
release.

## Release

Cut as `3.6.0` (MINOR, from `3.5.3`; the remote's newest tag was still `v3.5.3`) in one
`chore(release): 3.6.0` commit, the last on `main`, tagged `v3.6.0` and pushed with the tag named on
the push line. No GitHub Release is published. The heading carries the real date of the cut,
2026-10-02 (UTC). Decision 10 held: phase C found no operator step, the rollback probe (6.4) passed,
and the only additions since phase B are a frontend control, a Gateway header and the Gateway's two
public splash paths. The `3.6.0` section says, in the operator's words: every member redeploys, lead
first; no operator configuration changes; crew protocol stays 2, so a 3.5.x member keeps working
beside a 3.6.0 lead and rolling back to 3.5.x is a plain redeploy; both harness ports remain temporary,
the Claude one now also covering the interrupt and agents hints; opening a pane behind the Gateway now
marks it seen; the rail gains "Mark all seen".

Hand-off (8.1): deploy the lead first, then the remaining member, following the Migration Plan above.
The push is not a completed adoption: this change stays active until the lead and the designated
member both run 3.6.0, lead first (decision 11); task 8.2 archives it then.
