## Why

The tree corresponds to Collie `v1.22.6` (tag object `a2ada8ffc89a8f3366c2128199689c0535cef262`,
commit `9cc40c8a3e75e9547e711d52d49bf5c1dd7d2aba`; Herdr Fleet 3.17.0 through 3.22.0). Upstream has
since published `v1.23.0` through `v1.23.3` (tag object `d20a39f274087c5a58ef1e6f5fed909c28a64935`,
commit `5bb4233b07cbfed2239fcfd7fe013323b55ac49c`): 339 commits and 604 files past the baseline.
1.23.0 brings walky talky (agent sessions messaging each other through the bridge, its `collie
walky` verbs, a signed crew route and phone cards), a skill that teaches agents those verbs and that
`collie update` now writes into every harness on the machine (ADR 0111), Stable and Edge release
lines with a Roll back button, a shell-line record, Tasks and Agents pills, and many reader and send
fixes — among them a second turn check on the read Enter is minted on. 1.23.1 and 1.23.2 fix more
send rules (notice keys on a first line, the Claude survey as a notice, pi's extension box, Grok and
opencode running rows); 1.23.3 raises Collie's Bun floor to 1.4.4, the first Bun that rejects the
compromised eMudhra intermediates. The owner has approved adopting `v1.23.3` in one step.

## What Changes

- Adopt Collie `v1.23.3` as one three-way merge whose second parent is
  `5bb4233b07cbfed2239fcfd7fe013323b55ac49c`, after a clean-tree preflight. `CLAUDE.md` stays the
  relative symlink to `AGENTS.md`; the version files stay at 3.22.0 until the release commit, which
  the owner cuts.
- **Every Fleet send port stays** (owner decision). The patient bounds, the probe cleanup and sweep,
  the 3 s key token, Codex's Enter that steers, the disabled hold queue and the Claude notice hint are
  re-applied on top of upstream's reworked send rules. Where upstream now checks the turn again on
  the read Enter is minted on, a Codex text that meets a turn started while it was typed still goes
  in with Enter; that is stated in `fleet-enter-steers`.
- **`collie skill sync` is off by default in Fleet** (owner decision). Upstream's update, rollback
  and line switch write the walky talky skill into every harness on the machine; in a Herdr Fleet
  checkout they write nothing unless the operator turns `COLLIE_SKILL_SYNC` on, and print upstream's
  one note instead. The decision lives in a fork-owned module; the updater gains one import and one
  call. `fleet-plugin-runtime` states it.
- **Walky talky is adopted as upstream ships it** (owner decision): kept, not wired into Fleet, and
  its crew route rides the existing crew link without breaking the Fleet routes.
- **Bun floor 1.4.4** (owner decision): Fleet's declared floor follows Collie's `MIN_BUN`, and the
  STT deadline capability that rests on the floor says so.
- **No automatic publication.** Upstream's release workflow now also builds Edge pre-releases from
  `vX.Y.Z-edge.N` tags; the fork keeps it on `workflow_dispatch` only, so neither a Stable nor an Edge
  tag publishes anything.
- Review every invasive entry against `v1.23.3` and advance it. Set `[upstream]`, add the
  `UPSTREAM.md` row and make `v1.23.3`'s changelog the byte-exact prefix of `COLLIE_CHANGELOG.md`.

**Non-goals:**

- No specification of upstream behaviour (walky talky, release lines, the shell-line record, the new
  readers and pills).
- No Fleet wiring for walky talky, no skill install, no `collie` CLI verb run against a Fleet
  deployment, no Edge line.
- No change to the send ports' numbers or decisions; no new reader port.
- The version bump: the owner cuts the release (at least MINOR, every member redeploys).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-plugin-runtime`: a Fleet checkout's update writes no agent skill unless the operator turns
  the sync on.
- `fleet-stt-deadline-compat`: the declared runtime floor is Bun 1.4.4.
- `fleet-enter-steers`: a Codex text that meets a turn started while it was typed still goes in with
  Enter.

`fleet-upstream-sync` carries no delta; this adoption follows it as written.

## Impact

- Everything Collie changed between `v1.22.6` and `v1.23.3`.
- Predicted textual conflicts (`git merge-tree`): `.github/workflows/release.yml`, `CHANGELOG.md`,
  `CLAUDE.md`, `CREW_PROTOCOL.md`, `bridge/crew/forward.ts`, `herdr-plugin.toml`, `package.json`,
  `web/package.json`, `web/src/components/agent-chat.tsx`, `web/src/components/chat-cards.tsx`,
  `web/src/components/composer.tsx`, `web/src/components/display-prefs.tsx`, `web/src/lib/api.ts`,
  `web/src/lib/loaders.ts`, `web/src/routes/detail.tsx`. The preflight reports 23 disturbed and 8
  untouched entries and no owned path occupied.
- Invasive boundary: one new port (the updater's skill sync call), no entry retired.
- Operators: every member redeploys (MINOR), the lead first, each on Bun 1.4.4 or later.
