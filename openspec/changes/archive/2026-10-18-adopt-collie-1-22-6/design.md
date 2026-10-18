## Context

See proposal.md, "Why". The ground was read before anything changed:

```
baseline  v1.20.1  tag f8ce7bd4…  commit 3c08e4f2…   (FORK.toml [upstream]; = merge-base main v1.22.6)
target    v1.22.6  tag a2ada8ff…  commit 9cc40c8a…   1224 files (v1.20.2 … v1.22.5 included)
preflight (bun scripts/check-fork.ts --target v1.22.6, before this change existed, no active change):
          28 of 30 invasive entries disturbed; 2 untouched; no owned path occupied
boundary  bun run test:fork: 21 pass; 1001 owned and 70 invasive paths
```

Upstream's changelog was not truncated: `v1.22.6`'s `CHANGELOG.md` carries `v1.20.1`'s text below its
new releases unchanged, so `COLLIE_CHANGELOG.md` becomes `v1.22.6`'s file verbatim, with no seam.

## Goals / Non-Goals

**Goals:** `v1.22.6` as real ancestry, every port reviewed; the fork's own Codex reader port retired
with real-pane verification of upstream's readers left to the owner; every fork feature working on the
new send pipeline, through the Gateway and across the crew; the fork's look kept under the default
theme and the shell legible under the others; the invasive count not grown.

**Non-Goals:** as in proposal.md.

## Decisions

### 1. The merge and its conflicts

Fourteen paths conflicted, each inside a declared entry. Contract files (`herdr-plugin.toml`, both
`package.json`, `CHANGELOG.md`) keep this product's identity and 3.16.3; `CLAUDE.md` stays the
symlink (upstream's maintainer text about its browser leg and release gates is upstream's release
procedure and is not ported into `AGENTS.md`); `COLLIE_CHANGELOG.md` is `v1.22.6`'s file verbatim.
The pre-commit hook keeps its five independent guards and takes upstream's wider lint exclusion
(`examples/`, `experiments/`). The crew forward test and the two wire-key baselines carry both
sides. The Chat cards put the density marker on upstream's new pending-turn markup. The Pane page
keeps the terminal-surface gate (`chatOffered`) beside upstream's Screen pill and screenless panes,
keeps its uncapped column (taking upstream's new `chatRootRef`), and keeps its own `hasOutput` find
gate. Upstream deleted `web/e2e/codex-padding.spec.ts` (its claim moved to vitest); the deletion is
taken and the fork's tablet skip leaves with it.

### 2. The reader ports are retired (owner decision)

`markers.ts` and `invariants.test.ts` take upstream's text; the owned helper, its suite, its two
fixtures, the `codex-status-row-compat` owned entry and the `codex-headless-status-row-port` entry
are removed. Reading upstream's code against the two retired fixtures, `v1.22.6` still does not read a
headless multi-item status row with an unpainted right-aligned notice (its `rejoinSplitSeparators`
covers the painted separator space, not the unpainted gap-and-glyph run), so such a screen would
show no composer. The owner chose upstream's readers as shipped and verifies real panes; no port is
re-added. No other fork change sits under the Claude or Codex readers or their send paths. Upstream
also still splits Claude's footer hints only on ` · `, so `↓ to manage` followed by a right-aligned
notice still reads as naming a modal key; no port is added for it.

### 3. The send pipeline

The composer keeps the record control ahead of upstream's whole Send chain (Answer first, the
destructive confirm, Send) and takes upstream's checked send: the type-anyway pre-flight is gone
upstream, so the fork's `submitLine` is upstream's destructive gate plus `send(line, true)`. Task
delivery (`useFleetTaskComposer`) is offered while the Send slot is `send` or `running` — upstream
holds a send made during a turn and sends it when the turn ends — and never over a draft, a dialog,
an unreadable screen or a pending offer; its suite drives upstream's `/api/send`. On the fork's
terminal surface no composer is mounted, so upstream's floating held-send card shows only on the
mirror. Keyboard commands, Keys and Type controls use unchanged APIs. The Gateway has no route
allowlist and its request-header allowlist needs nothing new (the request id rides the body), so
`/api/send`, `DELETE /api/send/<id>`, `/api/send/receipts` and `/api/surface` pass; pairing writes are
still refused. Crew forward keeps its `pane.focus` audit name beside upstream's new forwardable verbs.
A 1.22 lead refuses checked text to an older member, so the lead is levelled first.

### 4. Themes, hooks, durable agents, build

Under the default theme the header's fill became `--band-ground`; the shell now scopes it to the
chrome value with `--background`, so the fork's header look is unchanged and header and rails agree
under every theme. Upstream's new faces and the display-face stacks get the CJK UI fallback from
later fork blocks in `index.css`, leaving upstream's blocks and its font suite unedited. The fork's
xterm surface keeps xterm's own palette. Hooks: the child self-registers in `hook-targets` (owner-
only, removed on clean stop); Fleet installs no hook and runs no CLI verb, and screen reading works
alone. Durable agents stay off (no `sources.json`, no `COLLIE_MUX=durable`). Bun floor unchanged
(upstream now also 1.4.0). The document CSP is byte-identical upstream, so the Gateway's font-origin
widening still applies. The release drift gate in `check-tag.sh` runs only for an untagged release
and only shapes its advice; the fork tags by hand before pushing, so it never blocks a release here
and its text is kept as upstream's.

### 4a. The strips' fold control returns

The fork withheld Collie's manual fold control at the tab row's trailing end because the strips then
folded on their own while the keyboard was up. Collie 1.21 retired that automatic fold (a fold that
moved the screen under the reader), so after the merge the strips could not be folded at all, which
upstream's own case caught. The control and its label helper return as upstream's text and
`fleet-pane-chrome` says so; re-implementing the retired automatic fold in the fork was rejected as
re-adding behaviour upstream removed on purpose. The owner may prefer otherwise; it is reported.

### 5. Every entry reviewed against v1.22.6

All 29 remaining entries were reviewed and advanced; none is dropped, because `v1.22.6` does none of
what they do. Kept as they were: native-row-actions-menu, unnarrowed-pack-rows, repository-guidance,
fake-network-fleet-routes, plugin-identity, downstream-version-line, fleet-build, native-agent-
favorites, pane-surface-route, native-pane-content, authenticated-navigation-cache (untouched),
native-manual-pane-fit, native-pane-page, crew-focus-audit-name (upstream still records a bare
`focus`), upstream-removal-clock, stable-table-corpus-test, terminal-binding-pin, native-chat-density-
markers, panel-navigation-ancestry, portable-tool-lookup-fixture, portable-loose-install-fixture,
offline-page-fixture-setup (untouched). Adapted: composer-voice-rank (the 1.22 Send chain and the
task-delivery gate), declined-centred-history-column (its browser path left with upstream's
deletion), native-pane-chrome (the header band), native-webfont (the theme faces), no-automatic-
release-publication (the drift gate), native-navigation-sidebars (names Collie's Conversations,
Updates and Changes columns as upstream's), private-fact-guard (wording). Dropped: codex-headless-
status-row (owner decision, section 2).

```
before  30 invasive entries, 70 invasive paths, 1001 owned paths
after   29 invasive entries, 67 invasive paths, 1002 owned paths
```

## Risks / Trade-offs

- A screen upstream's reader does not read on this operator's agents becomes visible as a refused or
  two-tap send rather than being patched. The owner accepted that; the evidence goes to the owner.
- A mixed-version crew refuses checked text to an older member until it updates, so the rollout order
  is lead first, then each member, with a send verified on each.
