## Why

The tree corresponds to Collie `v1.14.2` (tag object `5271116783decc927b84b4da9814d5fbef6277b7`,
commit `887a37dbfc5582d08c7d7703deadd53146f654bb`, Herdr Fleet 3.5.0, currently 3.5.3), and upstream
published `v1.15.0` on 2026-10-01: 81 commits over 257 files. It carries Collie's fix for a Codex
pane whose goal notice is padded in a field's colour (#317), which the fork's temporary headless
Codex status-row port sits directly beside, and a Settings split, a Chat body and a new Display sheet
that reach three of the fork's ports. Adopting it now keeps the fork one release behind at most, and
lets the Codex port be layered on upstream's reading in the same shape as the owner's upstream pull
request.

## What Changes

- Adopt Collie `v1.15.0` — tag object `1dba7de34afa9334a185f85e8f1d1947f4f723c3`, commit
  `ef01b0ed4d9271897413984075aa6d2060ffcf2a` — as one three-way merge whose second parent is that
  commit, after a clean-tree preflight; the 16 predicted conflict paths are all inside declared
  entries and are resolved from the entry that predicted them. `CLAUDE.md` stays the relative symlink
  to `AGENTS.md`; the version files stay `3.5.3` until the release commit.
- The Codex headless status-row port runs on what upstream's new `splitPaintedGaps` (#317) hands
  back, as the owner's upstream pull request integrates it; the fork-owned helper stays, its anchor
  moves, and it no longer passes `null` through.
- The manual Pane fit `Resize` row moves with Collie's Display panel: Collie 1.15 replaced the
  composer's in-flow dock with a sheet the Pane page mounts and made its rows answer for the body on
  screen, so the row is handed to that sheet, among the terminal mirror's rows directly below Text
  size, and is absent from Chat's rows. The composer's Display port is gone and
  `web/src/components/composer.test.tsx` returns to upstream's text.
- The fork's terminal surface replaces Collie's new Chat body as it replaces the mirror: while it is
  selected Collie's Chat switch is not offered and no live session window is read.
- Settings is an index of sections upstream; the fork's group stays at the head of the index, the
  shared section shell loses its reading-column cap as the index does, and upstream's "the index
  holds no control of its own" test counts only Collie's controls.
- Upstream tests that collide with fork ports are settled at the boundary as in earlier adoptions: the
  1.15.0 contributor-credit case reads `COLLIE_CHANGELOG.md`, and the manual-fit capability test learns
  that `tuios` advertises no resize.
- Review all 25 invasive entries and advance each to `reviewed = "v1.15.0"`, set `[upstream]`, add the
  `UPSTREAM.md` row `3.6.0` → `1.15.0`, and make `v1.15.0`'s changelog the byte-exact prefix of
  `COLLIE_CHANGELOG.md` (nothing dropped, so no seam).
- Cut this product's release in the same change at MINOR, 3.5.3 → 3.6.0, in a later phase; this
  change stays active until every member runs it.

What the release brings is upstream's: Chat as an opt-in pane body, the journal's structured tool
calls and live session window, tool calls folded in History, Settings as four sections, the pane
switcher's Place, Activity and cache orders, Copy output in the pane menu, push titles in the device's
language, the experimental tuios backend (`COLLIE_MUX=tuios`), canary and ledger updates (Claude Code
2.1.285, Codex 0.159.2) and many reader fixes. None of it is specified here.

**Non-goals:**

- No specification of upstream behavior, and no port beyond what the release requires.
- No Fleet ownership of `COLLIE_MUX`: the multiplexer setting stays Collie's, as it was for tmux and
  zellij; `tuios` is a new value of an existing key.
- No Agents-rail support for the pane switcher's orders, and no change to the Gateway's public file
  list for the new boot-splash marks.
- No port of upstream's `CLAUDE.md` changes into `AGENTS.md`, as in earlier adoptions.
- **Deployment is out of scope.** Levelling the members belongs to the private parent repository.

## Capabilities

### New Capabilities

None. An adoption imports upstream behavior, and upstream behavior is not specified here.

### Modified Capabilities

- `fleet-harness-compat`: the headless Codex status-row exemption composes with Collie 1.15.0's own
  reading of a painted notice padding (#317) and stays until upstream reads the headless row itself.
- `fleet-manual-pane-fit`: `Resize` is one of the terminal mirror's Display rows and is absent while
  the Pane is drawn as Collie's Chat body.
- `fleet-pane-terminal`: the terminal surface replaces Collie's Chat body as well as the mirror, offers
  no Chat switch and reads no Chat session; with the mirror selected, Collie's own body choice applies.
- `fleet-native-navigation-sidebars`: every Settings page fills the route column, the index and each
  section; the rails ignore the pane switcher's order like the dashboard's other device choices, and
  the requirement now names the pin as the one choice the Agent rail honours.

`fleet-upstream-sync` carries no delta: this adoption follows it as written, and the `UPSTREAM.md`
provenance row is data its existing requirement already demands, not a requirement change. Per that
specification, no delta is invented.

## Impact

- Everything Collie changed between `v1.14.2` and `v1.15.0`; no dependency change in either package
  manifest; `test:crew` now runs `integration/crew-harness.test.ts`.
- Predicted conflicts (read-only `git merge-tree`): 16 paths, every one inside a declared entry; the
  release renames three upstream test files, none of them a declared path; no owned path occupied.
- Fork-owned: `web/src/lib/fleet-codex-status-row.ts` and its suite,
  `fleet/manual-pane-fit/capability.test.ts`, `docs/herdr-fleet.md`.
- Invasive: ports in `bridge/`, `web/src/`, `scripts/release-notes.test.ts`, the new
  `web/src/components/settings-page.tsx` and `web/src/routes/settings.test.tsx`, as enumerated in
  `FORK.toml`.
- `FORK.toml`, `UPSTREAM.md`, `COLLIE_CHANGELOG.md`, `CHANGELOG.md`, and (at release) the three version
  files.
- Operators: every member redeploys (MINOR), lead first. No Fleet configuration key, enrolment step or
  state file changes; crew protocol stays 2 and the new `chat` read is additive.
