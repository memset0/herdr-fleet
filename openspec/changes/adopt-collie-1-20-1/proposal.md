## Why

The tree corresponds to Collie `v1.19.0` (tag object `35d8c000da23326227f7843c948eae9783d72cce`,
commit `632a2bf784045b1e2576da112d89ed21fecc9eeb`; Herdr Fleet 3.15.0 and the 3.15.x patches after
it). Upstream has since published `v1.19.1`, `v1.19.2`, `v1.20.0` and `v1.20.1` (tag object
`f8ce7bd44ac9bc510f2b96c3f835096503335936`, commit `3c08e4f25d51a2dd62e3cb44d3f71850afd69557`):
119 commits over 387 files past the baseline. The central changes are speech: a Settings → Voice
page, a host Whistle engine downloaded from a pinned address and checked against a pinned hash, a
phone-side engine whose model is copied from the host, a host speech switch that records which device
changed it, and dictation that covers the composer with a recorder bar that finishes itself after two
seconds of quiet. The service worker now takes over at once and the page reloads once when an app
file went missing after an update. The owner has approved the adoption as a MINOR release.

## What Changes

- Adopt Collie `v1.20.1` as one three-way merge whose second parent is
  `3c08e4f25d51a2dd62e3cb44d3f71850afd69557`, after a clean-tree preflight. `CLAUDE.md` stays the
  relative symlink to `AGENTS.md`; the version files stay `3.15.6` until the release commit.
- **Dictation keeps its record control beside Send, adopts upstream's recorder bar, and never ends a
  clip on silence.** Idle, the record control stands beside Send as before (the fork's reversal of
  upstream `abdbf45`). While a clip records or transcribes, upstream's recorder bar covers the
  composer: its finish control stands where the record control stood, its discard control at the far
  end, a level display between them. In a Fleet build the bar's two-second quiet countdown is turned
  off — no ring closes and no clip finishes by itself; a clip ends only when the operator finishes it
  or discards it (or upstream's own recording cap). Hands-free sending after a finished clip is
  upstream's and is unchanged.
- **The service worker keeps the fork's network-first navigation** with the precached shell answered
  only when the network fails, and adopts upstream's immediate takeover, old-file cleanup and
  reload-once recovery from a missing app file.
- **Voice settings and the phone engine work through the Gateway.** The Gateway's document policy
  widening keeps every directive the adopted policy carries; the phone engine's worker, wasm and
  model copy, and the host speech routes, pass the Gateway unchanged. A host speech switch made
  through the Gateway is recorded under the Gateway's one device label.
- **Overlaps settled at review.** Pairing's new name rule accepts the Gateway's label; the Gateway
  still refuses pair and device revocation. The three worktree routes upstream removed have no fork
  caller. Upstream's crew-peer update rollback fix and its Intel Mac payload ride `collie update` and
  release packaging, which Fleet does not use.
- Review every invasive entry against `v1.20.1` and advance it. Set `[upstream]`, add the
  `UPSTREAM.md` row and make `v1.20.1`'s changelog the byte-exact prefix of `COLLIE_CHANGELOG.md`.
- Release axis **MINOR, 3.15.6 → 3.16.0**, cut after the full suites pass on a designated member.

**Non-goals:**

- No specification of upstream behaviour (Voice settings, Whistle, the phone engine, the recorder
  bar's look, pi/OmO questions, Grok resume, update-card retries).
- No Whistle model download and no host speech provider switch on any real machine as part of this
  change; both are operator acts.
- No new Fleet setting for the silence finish: it is off in a Fleet build, as the owner decided.
- No change to the Bun floor (1.4.0): `v1.20.1` still declares 1.3.14.
- No port of upstream's `CLAUDE.md` changes into `AGENTS.md` beyond what the fork boundary needs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-composer-voice`: while a clip runs the adopted recorder bar covers the composer, and in a
  Fleet build a clip ends only when the operator finishes or discards it, never on silence.

`fleet-upstream-sync` carries no delta. This adoption follows it as written.
`fleet-public-authentication` is unchanged: its navigation and proxy requirements already hold with
upstream's new worker behaviour and speech routes.

## Impact

- Everything Collie changed between `v1.19.0` and `v1.20.1`. Crew protocol and `MIN_BUN` unchanged;
  no dependency or lockfile change.
- Predicted textual conflicts (`git merge-tree`): `CHANGELOG.md`, `CLAUDE.md`, `herdr-plugin.toml`,
  `package.json`, `web/package.json`, `web/src/components/agent-chat.tsx`,
  `web/src/components/chat-cards.tsx`, `web/src/components/composer.tsx`,
  `web/src/lib/sw-routes.test.ts`, `web/src/sw.ts`. The preflight reports 17 disturbed and 13
  untouched entries and no owned path occupied.
- New invasive path: the one call in upstream's voice level hook that hands its speech detector to a
  fork-owned wrapper (attributed to `composer-voice-rank-port`).
- Operators: every member redeploys (MINOR), lead first. No configuration key, enrolment step or
  state file changes. Whistle and the phone engine are opt-in from Settings → Voice; until an operator
  chooses them, speech works as configured today.
