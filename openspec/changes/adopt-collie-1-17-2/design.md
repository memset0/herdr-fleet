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

### 3. The Chat gate follows Chat as the default

Collie 1.17.0 made Chat the default body of an agent Pane (ADR 0082). It removed the Experiments
opt-in (`chatExperiment`) and moved the body decision into `paneBody(…)` (`lib/chat-gate.ts`), fed by
the device's `paneView`. Its read also warms when the pane menu or the Display sheet opens. The fork's
gate keeps its meaning: while a fork content renderer is in place (the terminal surface), Collie's
Chat is neither chosen, warmed nor drawn. The port is one condition on upstream's own variables: the
chosen choice and the warming both require `renderContent === undefined`. Everything downstream of
them (the ⋮ row, the sheet's switch, the window's poll, the handover and ready-body sequencing) stands
down exactly as before. Collie's stored `paneView` is left alone for when the mirror is selected
again. Find keeps upstream's `display && !chatShown` gate. The fork's `hasOutput` already feeds
`display`.

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

### 7. `COLLIE_CHANGELOG.md`

`v1.17.2`'s changelog becomes the file's byte-exact prefix. Whether a seam is needed depends on
whether `v1.17.2`'s file still carries every entry the retained file has. This is checked at the
merge and recorded here.

### 8. Release axis: MINOR, 3.9.14 → 3.10.0

An adoption is at least MINOR (`fleet-upstream-sync`), and every member executes the new bridge. It
is not MAJOR: no Fleet configuration key, enrolment step, state file or contract changes, and crew
protocol stays 2 with additive fields. **Decided by the owner: 3.10.0.** The release is cut later,
after the full suites run on a designated member. The remote's newest tag is read first.

### 9. Archive waits for the members

As before, the push ends this repository's part. The change is archived only after the operator
reports the lead and the remaining member running 3.10.0, lead first.

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
