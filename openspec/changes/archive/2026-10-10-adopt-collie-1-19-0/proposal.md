## Why

The tree corresponds to Collie `v1.18.0` (tag object `990260b86d08b7e41f62fe5f2ed9a7e928d4b637`,
commit `2ab62eaac43c8971fc698f81a2465d3059fce938`; Herdr Fleet 3.14.0). Upstream has since published
`v1.18.1` and `v1.19.0` (tag object `35d8c000da23326227f7843c948eae9783d72cce`, commit
`632a2bf784045b1e2576da112d89ed21fecc9eeb`): 72 commits over 228 files past the baseline. The
central change is the New page (M48, ADRs 0091–0095): the bottom-sheet new-space form is deleted and
replaced by a `/new` route whose machine and pane ride in the address, which starts an agent, a
launcher row, a shell or a one-off command by id with a request id, offers launchers added from a
phone, a recent one-off history, and worktree bases. The Keys dock gains an editable pad (ADR 0092),
and model labels and agent availability are read from the screen and from each machine.

The fork's `host-workspace-form-port` patched the deleted sheet with a fixed Host, so the adoption
cannot keep it as it is. The owner has approved the adoption as a MINOR release.

## What Changes

- Adopt Collie `v1.19.0` as one three-way merge whose second parent is
  `632a2bf784045b1e2576da112d89ed21fecc9eeb`, after a clean-tree preflight. `CLAUDE.md` stays the
  relative symlink to `AGENTS.md`; the version files stay `3.14.0` until the release commit.
- **A Host row's New workspace action opens Collie's New page on that Host.** The action navigates to
  `/new` with the Host in the page's own `machine` address parameter (the lead's id for the lead), in
  the lead's primary session. The page's machine select shows the Host preselected. The fork's form
  port is retired with the sheet it patched, so `host-workspace-form-port` is dropped and its fork
  test file is removed. The page's own name field does not exist upstream any more: a workspace
  started from a Host row is named the way every New-page start is named.
- **The new routes are reached through the Gateway unchanged.** The Gateway already forwards every
  `/api/*` route with its own paired device's bearer; it refuses only pairing and device revocation.
  The crew-only `forget-device` route stays unreachable from a browser, as upstream already refuses
  it there. Launchers added from a browser are attributed to the Gateway's one device label, which
  survives every Fleet restart, so no restart removes them.
- **Overlaps settled at review.** The Keys dock's new pad editor is adopted as upstream wrote it; the
  fork's record control beside Send and the composer's other ports are kept. The crew focus audit
  name port is kept, because upstream has not fixed it.
- Review every invasive entry against `v1.19.0` and advance it. Set `[upstream]`, add the
  `UPSTREAM.md` row and make `v1.19.0`'s changelog the byte-exact prefix of `COLLIE_CHANGELOG.md`.
- Release axis **MINOR, 3.14.0 → 3.15.0**, cut after the full suites pass on a designated member.

**Non-goals:**

- No specification of upstream behaviour (the New page, launchers, one-off runs, the key board).
- No change to upstream defaults: one-off runs stay on for paired devices, which behind the Gateway
  means every operator the Gateway admits; that operator already has terminal access.
- No new invasive path for the New page; no Fleet ownership of launcher configuration.
- No port of upstream's `CLAUDE.md` changes into `AGENTS.md` beyond what the fork boundary needs.
- No change to the Bun floor (1.4.0): `v1.19.0` declares no newer runtime.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: a Host row's New workspace action opens Collie's New page with
  that Host preselected rather than a fixed-Host form.

`fleet-upstream-sync` carries no delta. This adoption follows it as written.

## Impact

- Everything Collie changed between `v1.18.0` and `v1.19.0`. Crew protocol and `MIN_BUN` unchanged.
- Predicted textual conflicts (`git merge-tree`): `CHANGELOG.md`, `CLAUDE.md`, `herdr-plugin.toml`,
  `package.json`, `web/package.json`, `web/src/components/agent-chat.tsx`,
  `web/src/components/new-space-sheet.tsx` (deleted upstream, modified here), `web/src/router.tsx`.
  The preflight reports 13 disturbed and 13 untouched entries and no owned path occupied.
- Fork-owned: `web/src/components/fleet-row-actions.tsx`, `web/src/components/fleet-host-actions.test.tsx`,
  `web/src/components/fleet-host-space-sheet.test.tsx` (removed), `FORK.toml`, `UPSTREAM.md`,
  `COLLIE_CHANGELOG.md`, `CHANGELOG.md`.
- Upstream path returning to upstream's state: `web/src/components/new-space-sheet.tsx` (deleted).
- Operators: every member redeploys (MINOR), lead first. No configuration key, enrolment step or state
  file changes. A member still on an older release answers the New page as an older Collie.
