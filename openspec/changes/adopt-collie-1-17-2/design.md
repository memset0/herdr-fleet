## Context

See proposal.md, "Why". The ground was read before anything changed:

```
baseline  v1.15.0  tag 1dba7de3…  commit ef01b0ed…   (FORK.toml [upstream]; = merge-base main v1.17.2)
target    v1.17.2  tag b73f66bc…  commit 3d562ae5…   386 commits, 769 files, released 2026-10-06
preflight (bun scripts/check-fork.ts --target v1.17.2, before this change existed, no active change):
          21 of 29 invasive entries disturbed; 8 untouched (native-pane-content-port,
          declined-centred-history-column, native-pane-chrome-port, private-fact-guard-port,
          fork-gate-in-ci, codex-headless-status-row-port, terminal-binding-pin-port,
          host-workspace-form-port); no declared path moved; no owned path occupied
```

`git merge-tree --write-tree --name-only HEAD v1.17.2^{commit}` predicts 19 conflicted paths, 18
content conflicts plus one type conflict. Every one is inside a declared entry:

| entry | conflicted paths | cause upstream |
| --- | --- | --- |
| `repository-guidance` | `CLAUDE.md` (distinct types) | upstream's agreement changed |
| `downstream-version-line` | `CHANGELOG.md`, `web/package.json` | the 1.15.1–1.17.2 sections; the version line |
| `plugin-identity` | `herdr-plugin.toml` | the version line |
| `fleet-build-port` | `package.json`, `tsconfig.json` | the version line; contract tests excluded from the root tsconfig (checked by `tsconfig.contract.json`) |
| `lint-parse-boundary` | `.oxlintrc.json` | `machine-parse.ts` joins the boundary list; a new Access-gate override |
| `native-manual-pane-fit-port` | `bridge/server.ts`, `bridge/crew/forward.ts`, `bridge/crew/forward.test.ts`, `bridge/solo-baseline.test.ts`, `bridge/types.ts`, `web/src/components/agent-chat.tsx` | the Files view's `files` pane read (ADR 0083), the Machines surface (ADR 0084), `toPaneWire` session discovery, Chat as the default body (ADR 0082) |
| `native-agent-favorites-port` | `web/src/components/agent-list.test.tsx`, `web/src/routes/home.test.tsx` | the dashboard's Activity/Cache orders and its Crew/Dashboard/Files tabs (ADR 0085) |
| `native-navigation-sidebars-port` | `web/e2e/dashboard-footer.spec.ts` | the footer's needs-you action replaced the Focus tab |
| `claude-manage-hint-port` | `web/src/lib/harness/claude/chrome.ts`, `index.ts` | upstream's `namesAModalKey` (#330) and the `ctrl+g to edit` draft hint |

What `v1.17.2` requires of an operator, read from the changelog and the source:

- **Configuration.** New Collie settings: `task_run_level`, `tern_bin`, `mux_endpoint_tern`,
  `access_team`, `access_aud`, `muse_root` and `stt_command`. None is renamed or removed, and Fleet
  sets none of them. `FLEET_OWNED_COLLIE_SETTINGS` is unchanged here (decision 6).
- **State.** New lead-side state files `machine-history.json` and `machine-alerts.json` sit in the
  Collie state directory. Nothing is renamed.
- **Routes.** `GET /api/pane/:id/files` and `GET /api/workspace/:id/files` (`device-read`, forwarded
  like `changes`), `GET /api/machines`, `GET /api/machines/:id/history` and
  `POST /api/machines/:id/alerts` (lead-only, not forwardable). The Gateway proxies every `/api/*`
  path behind its session, so it needs no rule (decision 5).
- **Crew link.** Protocol 2 is unchanged. `machineStats` rides the snapshot answer
  additive-optionally, and `files` joins the forwardable pane routes.
- **Runtime.** Neither package manifest changes a dependency. `MIN_BUN` and `min_herdr_version` are
  unchanged.

**Answer: no operator configuration changes.** Every member redeploys because the bridge changed.

## Goals / Non-Goals

**Goals:**

- `v1.17.2` in this history as real ancestry, every port reviewed against it.
- `claude-manage-hint-port` fully retired in favour of upstream's own reading.
- Upstream's new Chat default, Files view and Machines page meet the fork's ports explicitly, not by
  whichever side of a conflict was easier to keep.

**Non-Goals:** as in proposal.md.

## Decisions

### 1. Preflight, planning commit and the merge, as in the previous adoption

This change's planning artifacts are committed on their own, planning-only, before the preflight
runs, because the preflight refuses untracked paths. Once committed, this change is itself active, so
the preflight runs with `--allow-active-changes`. **The owner authorized this for this adoption's own
change (2026-10-08).** The previously active `refine-todoist-tree-ui` was archived first, on the
owner's acceptance.

The merge runs as `git merge --no-ff --no-commit 'v1.17.2^{commit}'`. `MERGE_HEAD` must be
`3d562ae5f8ca1b5bcbf8c4cab10064c955d5c704`. The conflicts are then resolved and the merge committed
with `git commit -F` and no pathspec (the merge exception).

Contracts:

- `CLAUDE.md` stays the relative symlink and no `CLAUDE.md~…` survives.
- `CHANGELOG.md` stays ours with one bold-lead Unreleased line.
- The version files keep `3.9.14`.
- `herdr-plugin.toml` keeps this product's identity.
- `COLLIE_CHANGELOG.md` takes `v1.17.2`'s changelog as a byte-exact prefix (decision 7).

The merge commit records the merge and its conflict resolution. The port retirement and the
boundary bookkeeping follow as their own commits.

### 2. `claude-manage-hint-port` is retired

Upstream `63bf5b61` (#330, 1.15.2) added `namesAModalKey` in `claude/chrome.ts`. It drops a closed
list of Claude's own status hints before the generic `namesAMenuKey` test: `esc to interrupt` and
`↓ to manage`, whole or clipped with `…`, and since 1.17.2 also the draft's `ctrl+g to edit` while no
plan dialog is on screen. Both the box locator (`tailNamesAMenu`) and the adapter's `modalOnScreen`
(`tailNamesAKey`) use it. This is the same repair the fork made at the same two call sites. Both call
sites therefore take upstream's text. The fork-owned recogniser, its suite, its four synthetic
fixtures, the `claude-mode-line-compat` owned entry and the `claude-manage-hint-port` invasive entry
are removed. `fleet-harness-compat` loses the requirement (REMOVED delta).

The two readings differ in scope:

- **Upstream** drops the hints from any row, wherever they stand: the mode line, a row of their own,
  or a footer.
- **The fork** dropped them only on the permission-mode line, and `↓ to manage` only as its last
  segment.

That makes upstream wider in one direction. A dialog footer reading `↓ to manage` alone is no longer
judged a modal by that row, although a real dialog still names other keys and is refused by them.
The fork's own case for that narrowing ("the background panel with `↓ to manage` as its only
footer hint") is synthetic: no capture has it.

It is narrower in another. A right-aligned notice after `↓ to manage` on the same row (for example
`… · ↓ to manage          new task? /clear to save 120.0k tokens`) leaves the hint glued to the
notice as one segment, which `DOWN_TO_MANAGE`'s anchored pattern does not match. That row is still
judged composer-unavailable upstream. **Accepted as a known gap by the owner (2026-10-08)**, to be
reported upstream, not ported.

Before the fork's suite is deleted, each of its working-screen and dialog cases is run against
upstream's reading, and the result is recorded below. A case other than the two accepted differences
above that fails on upstream's code is reported to the owner. The port is not kept for it.

**Record (task 4.1, on the merge commit, with upstream's `chrome.ts` and `index.ts` and the fork's
suite still present).** Run against upstream's reading, 47 of the suite's 49 cases pass. These
include all four working screens (`claude--manage-hint--w120`/`w73`,
`claude--v2286-agents-interrupt-manage-hint--w120`/`w93`), the three one-hint working-turn variants,
the mode line's trailing `Esc to cancel`, and upstream's own tasks and config dialog captures. The
earlier widening (`esc to interrupt` and a trailing `↓ to manage` on the permission-mode line) is
therefore covered upstream. Two cases fail, exactly the two scope differences above:

- "still reads as a working screen with a right-aligned notice after the hint" is the accepted gap.
- "the background panel with `↓ to manage` as its only footer hint is still a modal" fails because
  upstream's exemption is not limited to the mode line. The case is synthetic: upstream's tasks
  panel with its footer rewritten to that one hint. It is **reported to the owner** and not kept as
  a port.

### 3. The Chat gate follows Chat as the default

Collie 1.17.0 made Chat the default body of an agent Pane (ADR 0082). It removed the Experiments
opt-in (`chatExperiment`) and moved the body decision into `paneBody(…)` (`lib/chat-gate.ts`), fed by
the device's `paneView`. Its read also warms when the pane menu or the Display sheet opens. The fork's
gate keeps its meaning: while a fork content renderer is in place (the terminal surface), Collie's
Chat is neither chosen, warmed nor drawn. The port is one condition on upstream's own variables: the
chosen choice and the warming both require `renderContent === undefined`. Everything downstream of
them (the ⋮ row, the sheet's switch, the window's poll, the handover and ready-body sequencing) stands
down exactly as before. Collie's stored `paneView` is left alone for when the mirror is selected
again. Find takes the fork's terminal-aware `hasOutput` with upstream's `!chatShown`. Upstream's
`display` is empty under the terminal surface, and the terminal's cell-aware search is fork-owned.

Git auto-merged upstream's switch props over the fork's gate: the Display sheet's `paneView` control
and the pane menu's `paneView`, `onPaneViewChange` and `paneViewNote`. All three are restored to
`chatOffered ? … : undefined`. The fork's case "draws the terminal surface and offers no Chat switch
even when Chat is the standing body" fails with the gate replaced by `true`, which was checked, and
passes with it in place.

`fleet-pane-terminal` says "where this browser has opted into Collie's Chat body and chosen it". That
opt-in no longer exists, so the requirement now says Collie's own body choice, Chat by default
(MODIFIED delta). `fleet-manual-pane-fit` needs no change. Resize is still one of the mirror's rows
and absent on Chat. With Chat the default, an operator reaches Resize by choosing the terminal view
from the pane's ⋮ menu, as upstream reaches its own mirror rows.

### 4. The bridge, crew and test-inventory unions

| path | resolution |
| --- | --- |
| `bridge/server.ts` | `PANE_ROUTE` gains upstream's `files` beside the fork's separate `PANE_RESIZE_ROUTE`; `ServerOptions` carries both `manualPaneFit` and upstream's optional `machines` |
| `bridge/crew/forward.ts` | the forwardable grammar carries both `files` and `resize`; the audit map uses upstream's `isPaneRead` (now including `files`) and keeps the fork's `pane.focus`/`pane.resize` namespacing |
| `bridge/crew/forward.test.ts` | upstream's derivation of the pane action list; the expected inventory is the union (`files` and `resize`) |
| `bridge/solo-baseline.test.ts` | upstream's `PANE_ROUTE` with `files`, and the fork's resize route |
| `bridge/types.ts` | upstream's `toPaneWire` with session discovery, still stripping the fork's server-only `viewportRows` |
| `tsconfig.json` | upstream's include plus `fleet`, and upstream's contract-test `exclude` |
| `.oxlintrc.json` | upstream's rationale with the fork's sentence appended; the boundary list carries upstream's `machine-parse.ts` and the fork's four files; upstream's new Access-gate override follows unchanged |

### 5. The Gateway needs no new header or route

The page sends the same request headers in `v1.17.2` as in `v1.15.0`: `accept`, `content-type`,
`if-none-match`, `x-collie-seen`, `x-collie-build` (a response header) and, for pairing,
`authorization` and `x-device-id`. Pairing is never configured behind the Gateway, and the device
header is reset by Fleet. The Files view is a `device-read`, which takes the same device decision as
a write. Writes already pass through the Gateway, so the Files view does too. The new routes are all
under `/api/`, which the Gateway proxies behind its session. Forwarding to members happens
lead-to-peer over the crew link, never through the Gateway. `machineStats` rides the crew snapshot.
No change to `fleet/proxy.ts` or `fleet/gateway.ts` is needed, and none is made.

Crew addressing (#334, 1.15.3) changed `collie crew invite`/`add`, which hand out
`https://<full-name>`, and `crew join --address`, which now requires a port. Both live in Collie's CLI
(`cli/crew.ts`), which Fleet never invokes. Fleet mints and spends invites through
`bridge/crew/enrollment.ts` transitions, which are unchanged. Its own `pack-join` already requires
`--address <host:port>`, and the lead dials a peer's loopback projection with an explicit port.
Fleet's enrolment and reachability are unaffected.

### 6. The Cloudflare Access gate is left to an owner decision

Upstream 1.16 added an opt-in Access gate (`access_team`/`access_aud`, ADR 0081). When it is on, any
request carrying forwarding headers must hold a verified `Cf-Access-Jwt-Assertion`. The Gateway sets
`x-forwarded-host` and does not forward that header, so a Collie child with the gate on would refuse
every request through the Gateway. It is off unless both settings are given, and Fleet sets neither.
AGENTS.md says Fleet resets every ingress and identity setting it decides. Making these two
Fleet-owned would also make a `config.toml` that names them refuse Fleet's start. That is a
contract-visible decision, so it is not taken inside this adoption. It is reported to the owner.

### 6a. The two new Machines pages fill the route column

`fleet-native-navigation-sidebars` says no route may constrain itself to a centred reading column.
Collie 1.17's `/machines` and `/machines/:id` (`web/src/routes/machines.tsx`, `machine.tsx`) arrive
with the same `mx-auto … max-w-screen-sm` wrapper and `width="column"` header claim the Crew page had.
Both lose the cap and the claim exactly as Crew did: two new invasive paths under
`native-navigation-sidebars-port`, anchored on the uncapped wrapper class, with upstream's
`machines.test.tsx` and `machine.test.tsx` joining its `verify` list. That is a narrow port, and
without it the adoption would break a specified downstream behaviour. Collie's Changes route keeps
the width ladder it already had at the previous adoption, which this change does not revisit.

### 7. `COLLIE_CHANGELOG.md`

`v1.17.2`'s changelog becomes the file's byte-exact prefix. The file is `v1.17.2`'s changelog
verbatim, with no seam, because every retained release heading and entry is still carried. Two
differences were found and are recorded here as decisions:

- **An entry reworded in place.** Under `## [1.15.0]` → `### Fixed`, the entry "A URL an agent typed
  as itself is now a link you can tap" now says "only a Markdown link ever became an anchor" where it
  said "only a `[text](url)` link". It is the same release and the same commit (`623401a6`
  precedes it in that section), so this is upstream's correction of its own record. The adopted
  wording replaces the old one.
- **A paragraph dropped from the header.** The "Coming from 0.x?" paragraph is gone from the file's
  `## Upgrading` header. Upstream removed it deliberately in 1.16.1 ("Release pages and the
  changelog no longer repeat the upgrade path from 0.x"). It is header prose, not a release entry,
  so nothing is retained below a seam for it.

### 8. Release axis: MINOR, 3.9.14 → 3.10.0

An adoption is at least MINOR (`fleet-upstream-sync`), and every member executes the new bridge. It
is not MAJOR: no Fleet configuration key, enrolment step, state file or contract changes, and crew
protocol stays 2 with additive fields. **Decided by the owner: 3.10.0.** The release is cut later,
after the full suites run on a designated member. The remote's newest tag is read first.

### 9. Archive waits for the members

As before, the push ends this repository's part. The change is archived only after the operator
reports the lead and the remaining member running 3.10.0, lead first.

### 10. Entry review against `v1.17.2` (task group 5)

Every entry's anchors were re-read in the merged tree, and its `verify` list was run file by file
(browser tier excepted; that is phase C's). One entry was dropped (decision 2). Two upstream paths
joined `native-navigation-sidebars-port` (decision 6a). Two upstream tests took scoping ports. One
fork-owned test learned the Tern adapter. `reviewed = "v1.17.2"` is set on all 28 remaining entries.

| entry | decision | reason |
| --- | --- | --- |
| `native-row-actions-menu-port` | keep | the strips auto-merged; no new header-only row reaches a strip pill |
| `unnarrowed-pack-rows-port` | keep | the loaders auto-merged beside upstream's machines loaders |
| `repository-guidance` | keep | symlink contract held; upstream's agreement not imported |
| `fake-network-fleet-routes` | keep | Fleet's 404 sits beside upstream's new files and machines handlers |
| `lint-parse-boundary` | adapt | upstream's `machine-parse.ts` and the fork's four files share the list (decision 4) |
| `plugin-identity` | keep | only the version line conflicted |
| `downstream-version-line` | keep | `COLLIE_CHANGELOG.md` verbatim (decision 7); the credit cases pass |
| `fleet-build-port` | adapt | `fleet` included beside upstream's contract-test exclusion |
| `native-agent-favorites-port` | adapt | upstream's order-toggle case reads only row-slot buttons in Pinned |
| `pane-surface-route-port` | keep | the router auto-merged beside the Machines routes; the Chat gate rides `agent-chat.tsx` |
| `native-pane-content-port` | keep | `renderContent` untouched |
| `authenticated-navigation-cache` | keep | the worker's one change carries `machine` into notification data; network-first unchanged |
| `native-manual-pane-fit-port` | adapt | `files` beside `resize`; `machines` beside `manualPaneFit`; the Chat gate on the default body (decisions 3, 4) |
| `declined-centred-history-column` | keep | history untouched |
| `native-navigation-sidebars-port` | adapt | Machines pages uncapped; the footer e2e case opens the needs-you switch, still scoped to main |
| `native-pane-chrome-port` | keep | `paper` port intact |
| `native-webfont-port` | keep | `maple` anchors intact |
| `private-fact-guard-port` | keep | the hook is untouched upstream |
| `composer-voice-rank-port` | keep | the record-control cases pass |
| `fork-gate-in-ci` | keep | the step and fetch depth are intact |
| `no-automatic-release-publication` | keep | `release.yml` gained Windows build jobs; the trigger is still `workflow_dispatch` only |
| `upstream-removal-clock` | keep | reads `v1.17.2`; the `collie pack` alias stays until 2.0.0 |
| `downstream-docs` | keep | the exclusion is unchanged |
| `codex-headless-status-row-port` | keep | `markers.ts` is untouched upstream; the headless multi-item row is still unread |
| `stt-deadline-runtime-port` | keep | `provider.ts` gained the `local-cli` provider; the anchor is intact, and the deadline and provider suites pass |
| `stable-table-corpus-test` | keep | the sorted listing is intact beside upstream's new table captures |
| `terminal-binding-pin-port` | keep | pins and the browser baseline are untouched |
| `host-workspace-form-port` | keep | the new-space sheet is untouched |
| `claude-manage-hint-port` | **drop** | upstream's `namesAModalKey` (#330), decision 2 |

Tests settled at the boundary this time: `agent-list.test.tsx` "order: pins lead and are ranked
inside themselves" (row-slot buttons). The fork-owned `native-agent-rail.test.tsx` "mark all seen"
now reads the summary line's labelled count, because Collie 1.17 draws three or more counts bare,
each with its word in an `aria-label`. The fork-owned `fleet/manual-pane-fit/capability.test.ts`
now expects `tern: false`.

#### Phase A/B record (2026-10-08, this host)

- **Baseline.** `main` was `origin/main` (`420b6d52`, 3.9.14) plus the archive commit `f61470a5`.
  `bun run test:fork` gave 20 pass, with the boundary at 854 owned and 103 invasive paths.
  `bun test ./fleet` gave 655 pass and 0 fail.
- **Commits.** The planning commit is `38cc4a4c`. The preflight (`--allow-active-changes`, authorized)
  gave 21 disturbed, 8 untouched and no owned path occupied. The merge commit is `b8b0bf6c`, with
  parents `38cc4a4c` and `3d562ae5`, committed with every hook armed. `bun install` changed neither
  lockfile. The retirement commit is `1dc54049`.
- **Results.** Both typechecks (root, including upstream's contract pass, and web) are clean. The
  full-tree `bun run lint` is clean. `bun run build` passes. `bun run test:fork` passes, and the
  boundary check is clean with no lagging entry. `check-version.sh` and `check-private-facts` pass.
  `scripts/check-tag.test.sh` and `scripts/pre-commit.test.sh` pass. `bun test ./fleet` gave 655
  pass and 0 fail.
- **Verify lists.** All 64 bun `verify` files pass file by file. The 43 web `verify` files pass in
  batches. All fork-owned web suites (`fleet-*`, `native-*`: 20 files, 269 tests) pass. The harness
  tree (`src/lib/harness`) passes.
- **Load timeouts.** Running `agent-chat.test.tsx` and `fleet-pane-route.test.tsx` inside a 58-file
  parallel batch on this 3 GB host timed out eight cases at 5 s. Each file passes alone (166 / 0 and
  5 / 0). This is load, not a regression, and the designated member's full run is the arbiter.
- **Not run here,** by instruction: the full suites (`bun test ./bridge` hangs on this host), the
  browser tier, the UI check and the rollback probe. These are phase C on a designated member.

## Risks / Trade-offs

- [Chat is now the default body, so Resize is one ⋮ choice further away] → the requirement already
  places Resize on the mirror's rows, and upstream's own mirror rows move the same way.
- [Upstream's hint exemption is wider than the fork's] → a lone `↓ to manage` dialog footer is a
  synthetic case with no capture. Real dialogs still name other keys.
- [A right-aligned notice after `↓ to manage` still reads as a modal] → accepted gap, reported
  upstream.
- [The Files view lets an authorised session browse a member's workspace folders through the lead]
  → this is upstream behaviour under the same gates as a write. Fleet's Gateway session is that
  gate.

## Migration Plan

This change does none of the deployment. On the operator's side: level the lead to 3.10.0 first,
then the remaining member. No configuration edit, enrolment step or state rename is needed. Rolling
back to 3.9.x is a plain redeploy, because both sides speak protocol 2.
