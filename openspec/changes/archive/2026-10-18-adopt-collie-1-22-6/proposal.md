## Why

The tree corresponds to Collie `v1.20.1` (tag object `f8ce7bd44ac9bc510f2b96c3f835096503335936`,
commit `3c08e4f25d51a2dd62e3cb44d3f71850afd69557`; Herdr Fleet 3.16.0 and the 3.16.x patches after
it). Upstream has since published `v1.20.2` through `v1.22.6` (tag object
`a2ada8ffc89a8f3366c2128199689c0535cef262`, commit `9cc40c8a3e75e9547e711d52d49bf5c1dd7d2aba`):
1224 files past the baseline. The central change is the send pipeline ("Surface", 1.22.0): stricter
prompt and box reads before any key, a two-tap "Type here" for a screen Collie cannot read, sends held
until the turn ends, send outcome notices at the Send slot, Recent sends, and per-harness input
profiles — Codex now sends with Tab and its approval and trust prompts answer from the phone. 1.22.0
also brings themes, hook edges, a held Claude permission answer, and experimental durable agents. The
owner has approved adopting `v1.22.6` in one step as a MINOR release.

## What Changes

- Adopt Collie `v1.22.6` as one three-way merge whose second parent is
  `9cc40c8a3e75e9547e711d52d49bf5c1dd7d2aba`, after a clean-tree preflight. `CLAUDE.md` stays the
  relative symlink to `AGENTS.md`; the version files stay at the current 3.16.x until the release
  commit.
- **The fork's own Codex screen-reader port is retired; Codex and Claude Code are read by upstream's
  readers as shipped.** `codex-headless-status-row-port` and its owned helper, suite and fixtures are
  removed, and `markers.ts` and `invariants.test.ts` return to upstream's text. The owner decided this
  for the adoption: upstream's readers are verified on real panes, and a failure found there is
  reported with its evidence rather than answered with a new port.
- **Every fork feature keeps working on the new send pipeline.** The fork's task composer, terminal
  bound task delivery, keyboard commands, the microphone beside Send and the Keys/Type controls ride
  upstream's new send path and its notices; sends reach a crew member through the lead.
- **Themes do not break the Fleet shell.** Under the default theme Fleet keeps its look; under the
  other shipped themes the shell, the fonts (CJK fallbacks included) and the chat density markers
  stay legible.
- **Upstream's hook edges, held permissions and durable agents are not enabled by Fleet.** Fleet runs
  no Collie CLI verb, installs no hook into an operator's agents, and leaves durable agents off; the
  bridge keeps working by screen reading.
- **Overlaps settled at review** (recorded in the design): the Gateway still refuses pair and device
  revocation and passes upstream's new routes; the service worker stays under its precache limit;
  the Bun floor; the release drift gate against the fork's untouched-publication rule.
- Review every invasive entry against `v1.22.6` and advance it. Set `[upstream]`, add the
  `UPSTREAM.md` row and make `v1.22.6`'s changelog the byte-exact prefix of `COLLIE_CHANGELOG.md`.
- Release axis **MINOR, 3.16.x → 3.17.0**, cut after the full suites pass on a designated member.
  The lead is levelled first, then every member, because a 1.22 lead refuses checked text to an
  older member.

**Non-goals:**

- No specification of upstream behaviour (the send pipeline, themes, hooks, durable agents, new
  harness profiles).
- No new reader port for Codex or Claude Code in this change, even if a real pane shows a gap.
- No hook installation, no `collie` CLI verb run against a Fleet deployment, no durable agent.
- No Fleet theme of its own and no theme setting beyond upstream's.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-harness-compat` is retired: its one requirement was the Codex headless status-row exemption,
  which this adoption removes, so the capability's specification is deleted with it (OpenSpec cannot
  archive a delta that leaves a capability with no requirement). Codex panes are read by the adopted
  upstream reader alone.
- `fleet-pane-chrome`: the strips' fold is Collie's own. Collie 1.21 retired the automatic fold the
  fork relied on when it withheld the manual fold control, so the tab row keeps Collie's control.

`fleet-upstream-sync` carries no delta; this adoption follows it as written. Other capabilities are
listed in the design only if adapting a port changes what they say.

## Impact

- Everything Collie changed between `v1.20.1` and `v1.22.6`.
- Predicted textual conflicts (`git merge-tree`): `CHANGELOG.md`, `CLAUDE.md`, `herdr-plugin.toml`,
  `package.json`, `web/package.json`, `scripts/git-hooks/pre-commit`, `bridge/crew/forward.test.ts`,
  `bridge/solo-baseline.test.ts`, `web/src/lib/solo-baseline.test.ts`, `web/e2e/codex-padding.spec.ts`,
  `web/src/components/agent-chat.tsx`, `web/src/components/chat-cards.tsx`,
  `web/src/components/composer.tsx`, `web/src/lib/harness/codex/markers.ts`. The preflight reports 28
  disturbed and 2 untouched entries and no owned path occupied.
- Invasive boundary: one entry retired (two paths); no new port planned.
- Operators: every member redeploys (MINOR), the lead first. Details of configuration, state and
  runtime are in the design.
