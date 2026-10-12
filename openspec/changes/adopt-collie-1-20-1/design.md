## Context

See proposal.md, "Why". The ground was read before anything changed:

```
baseline  v1.19.0  tag 35d8c000…  commit 632a2bf7…   (FORK.toml [upstream]; = merge-base main v1.20.1)
target    v1.20.1  tag f8ce7bd4…  commit 3c08e4f2…   119 commits (v1.19.1, v1.19.2, v1.20.0 included), 387 files
preflight (bun scripts/check-fork.ts --target v1.20.1, before this change existed, no active change):
          17 of 30 invasive entries disturbed; 13 untouched; no owned path occupied
boundary  bun run test:fork: 21 pass; 968 owned and 69 invasive paths
```

What `v1.20.1` requires of an operator, read from the changelog and the source:

- **Configuration.** None renamed or removed. Whistle and the phone engine are opt-in from Settings →
  Voice or `collie stt whistle`; a host with no speech configured stays without it.
- **State.** Collie adds a `whistle` folder in its state directory when the model is downloaded, and
  `stt.json` gains `changedBy`/`changedAt` when a device switches host speech. Nothing is renamed.
- **Runtime.** `MIN_BUN` unchanged (1.3.14 upstream; the fork's floor stays 1.4.0); no `engines`
  change; no dependency or lockfile change. Crew protocol unchanged.

**Answer: no operator configuration changes**, so the axis is MINOR.

## Goals / Non-Goals

**Goals:** `v1.20.1` as real ancestry, every port reviewed; the record control beside Send kept and
upstream's recorder bar adopted with its silence finish off in a Fleet build; the fork's
network-first navigation kept beside upstream's new worker recovery; Voice settings, the phone engine
and host speech proven through the Gateway; the invasive count not grown beyond the one call the
silence decision needs.

**Non-Goals:** as in proposal.md.

## Decisions

### 1. The silence finish is off in a Fleet build, through one wrapped call

Upstream's recorder bar (`voice-takeover.tsx`) runs `useVoiceLevels`, which creates one speech
detector per clip (`createSpeechEndpoint()`, `lib/speech-endpoint.ts`) and, on the frame the detector
reports `finish`, calls the bar's `onStop` — the same callback OK calls. The ring round OK is drawn
from the detector's `progress`. So the call site in `composer.tsx` cannot tell OK from silence, and
passing no level source (upstream's own "no auto-finish" case) would also flatten the level display.

The decision is made in the fork-owned `web/src/lib/fleet-voice-finish.ts`: `fleetSpeechEndpoint`
takes upstream's detector and, in a Fleet build (`isFleetBuild()`), returns one whose frames carry
upstream's `speaking`, `heard`, `floor`, `threshold` and `silentMs` unchanged and `progress: 0`,
`finish: false`. `use-voice-levels.ts` gains one import and wraps its one `createSpeechEndpoint()`
call. The level display, its speaking/quiet ink and reduced-motion behaviour stay upstream's; the
ring never shows; OK, the bin, Escape and upstream's recording cap still end a clip. Outside a Fleet
build the wrapper returns upstream's detector, so upstream's suites and browser tier keep their
countdown cases unchanged.

Alternatives: a new `autoFinish` prop on `VoiceTakeover` threaded to the hook (two upstream files and
new upstream logic — rejected); wrapping the level source at the composer's call site so the detector
never hears speech (no new path, but the bars' speaking ink and the reduced-motion display go flat —
rejected); a Fleet setting (the owner decided off; no setting).

Interactions: hands-free decides what happens to a transcript after the clip ends and is untouched —
with hands-free on, OK finishes and the transcript is sent as upstream sends it. The fork's microphone
keyboard commands (`decideMicCommand`) start, finish and discard through the composer's recorder, so
they are the operator's own finish and remain the way to end a clip from the keyboard.

### 2. The service worker: network-first navigation kept, upstream's recovery adopted

Upstream's worker already took over at once (`skipWaiting`, `clientsClaim`, the activate sweep) at
1.19; 1.20 adds a cache-first `stt/` route for the phone engine and its sweep, and the reload-once
recovery lives in `lib/chunk-reload.ts`, `main.tsx` and `lib/pwa.ts`, none of which the fork touches.
So the fork's network-first `NavigationRoute` stays first and upstream's precached-shell route stays
dropped; everything else in the worker is upstream's. The recovery's one reload is a navigation and
goes through the network-first route, so an expired session lands on the Gateway's answer. A missing
`/assets/*` file is a real 404 (the Gateway serves those paths without a session), never a login page.
The `stt/` cache keeps only unredirected answers of the promised type, so a Gateway login redirect is
never stored; the model the page keeps under an API-shaped key is a public, hash-checked file, not
protected data, and the worker has no `/api/` route. `fleet-public-authentication` holds unchanged.

### 3. Voice through the Gateway

- **Policy.** Collie's page policy is unchanged at 1.20 and already carries `worker-src 'self'`; the
  page never gains `'wasm-unsafe-eval'`. Every `stt/*.js` is served with its own worker policy
  (`default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; base-uri 'none'`). The Gateway widens
  only an HTML document's `style-src`/`font-src`, so the worker's policy passes untouched and every
  other page directive is copied verbatim (`fleet/proxy.test.ts` cases).
- **Engine files.** `/stt/needle-*/needle.{js,wasm}` and the worker are not public Gateway assets: a
  session reaches them through the proxy with their own types; without one they are the login
  redirect, which the engine's hash check and the `stt/` cache both refuse.
- **Model copy.** `GET /api/stt/model/<sha256>` streams the model with a length, a tag and a sandbox
  policy and no range support. The proxy streams the body and drops the length (it rewrites framing);
  the phone measures progress against the size the host's status reports, so the bar is unaffected.
  The Gateway sets no idle timeout of its own beyond Bun's default, and a continuous stream is not
  idle. Download to the host is `POST /api/stt/whistle` answered `202` and polled, so no long request.
- **Host speech switch.** `PUT /api/stt/host` and the Whistle writes use Collie's write guard, which
  the Gateway's paired device passes; `changedBy` records the device's pairing name, which behind the
  Gateway is always `fleet-gateway`.
- **Federation.** No speech route is forwarded across the crew link: "your host" is the lead's Collie.
  A phone behind the Gateway copies the model from the lead, and a member's Settings → Voice is not
  reachable as a separate host.
- **Carried risk, not introduced here.** A host transcription answers only when done (Whistle allows
  up to 180 s), and Bun closes a request whose handler is silent for 10 s unless the server raises
  `idleTimeout` or calls `server.timeout(req, …)` (measured on Bun 1.4.2). Collie does that for its
  worktree route only, not for `POST /api/stt`, and the Gateway raises nothing. So a host
  transcription longer than 10 s fails at Collie's own listener whether or not the Gateway is in
  front; the fix belongs upstream, and the phone engine avoids it. Left for the owner.

### 4. Overlaps

- Pairing names (1.20.0) refuse control and invisible characters; the Gateway's label is plain ASCII.
- The removed worktree routes and web pieces have no fork caller.
- The crew-peer update rollback fix and the Intel Mac payload live in `collie update` and release
  packaging; Fleet never invokes Collie's CLI against a deployment (ADR-level rule in AGENTS.md).
- None of the three upstream pull request branches (focus audit name, table corpus order, Codex
  headless status row) is fixed in `v1.20.1`; their ports stay.

### 5. Merge resolutions

Before the merge, `CHANGELOG.md` was repaired in its own docs commit: the 3.15.6 release had renamed
the `## [Unreleased]` quoted in the file's introduction, splitting that sentence and leaving the empty
Unreleased heading below 3.15.6's note. Then ten paths conflicted, each inside a declared entry:

| path | resolution |
| --- | --- |
| `CLAUDE.md` (and upstream's file beside it) | symlink to `AGENTS.md` kept; upstream's additions are its own working agreement and not ported |
| `CHANGELOG.md`, `herdr-plugin.toml`, `package.json`, `web/package.json` | ours; upstream changed only its version number |
| `web/src/sw.ts` | both imports: the fork's network-first navigation and upstream's speech cache helpers |
| `web/src/lib/sw-routes.test.ts` | upstream's three-route count with the fork's network-first assertion |
| `web/src/components/composer.tsx` | the fork's microphone commands kept beside upstream's takeover state, focus return and keyboard-open mark; upstream's `micIsPrimary` and its mic-or-Send branch dropped; the record control beside Send takes upstream's `micShown`/`micAvailable` (host provider or phone engine), records how it was opened and carries the `composer-primary` slot the takeover returns focus to |
| `web/src/components/agent-chat.tsx` | upstream's copy helpers imported; `MessageKey` not, as the fold label it typed is not drawn |
| `web/src/components/chat-cards.tsx` | upstream's copyable command and output blocks, with `data-chat-inset` on their padded row and output |

Beyond the conflicts, `fleet/ui/mic-commands.ts` learns the recorder's new `failed` phase (refused for
every command, with a Fleet string in each dictionary), because the composer hands it the phase.
`COLLIE_CHANGELOG.md` is `v1.20.1`'s changelog verbatim: upstream only added the 1.19.1–1.20.1
sections, so no seam, no retained text and no reworded entry.

### 6. Entry review

| entry | disturbed | decision |
| --- | --- | --- |
| native-row-actions-menu-port | no | keep |
| unnarrowed-pack-rows-port | no | keep |
| repository-guidance | `CLAUDE.md` | keep (symlink) |
| fake-network-fleet-routes | no | keep |
| plugin-identity | version | keep |
| downstream-version-line | `CHANGELOG.md`, `cli/update-check.test.ts`, `web/package.json` | keep; the test's Collie sections still read `COLLIE_CHANGELOG.md` |
| fleet-build-port | `package.json` | keep |
| native-agent-favorites-port | no | keep |
| pane-surface-route-port | `router.tsx` | keep (auto-merged beside the Voice settings route) |
| native-pane-content-port | no | keep |
| authenticated-navigation-cache | `sw.ts`, `sw-routes.test.ts` | adapt (decision 2); reason updated |
| native-manual-pane-fit-port | no | keep |
| native-pane-page-port | `agent-chat.tsx`, its test | keep; copy helpers taken (reason updated) |
| crew-focus-audit-name-port | `forward.test.ts` | keep; upstream still names a forwarded focus bare |
| declined-centred-history-column | no | keep |
| native-navigation-sidebars-port | `settings.tsx`, `settings-page.tsx` | keep; the Voice pages fill the column through the shared shell (reason updated) |
| native-pane-chrome-port | no | keep |
| native-webfont-port | `index.css`, `DESIGN.md` | keep (auto-merged) |
| private-fact-guard-port | no | keep |
| composer-voice-rank-port | `composer.tsx`, `composer-stt.test.tsx`, `docs/voice-and-push.md` | adapt (decision 1, merge table); new path `use-voice-levels.ts`; reason updated |
| no-automatic-release-publication | `release.yml` | keep; `workflow_dispatch` only, upstream's new macOS x64 row harmless |
| upstream-removal-clock | `cli/program.test.ts` | keep |
| codex-headless-status-row-port | no | keep (upstream PR branch not adopted) |
| stable-table-corpus-test | no | keep (upstream PR branch not adopted) |
| terminal-binding-pin-port | `bridge/types.ts`, `bridge/solo-baseline.test.ts`, `web/src/lib/types.ts` | keep (auto-merged beside the speech types) |
| native-chat-density-markers | `chat-cards.tsx` | adapt (merge table); reason updated |
| panel-navigation-ancestry-port | `nav.ts` | keep (auto-merged) |
| portable-tool-lookup-fixture | no | keep |
| portable-loose-install-fixture | `scripts/collie-cli.test.sh` | keep |
| offline-page-fixture-setup | no | keep |

Boundary: 968 owned / 69 invasive paths in 30 entries before; after, 975 owned (this change's five
OpenSpec files, `fleet-voice-finish.ts` and its test) / 70 invasive in 30 entries — the one new path is
the wrapped detector call in `use-voice-levels.ts`. No port could be retired: none of the three
upstream pull request fixes is in `v1.20.1`.

## Risks / Trade-offs

- A clip left recording runs until the operator ends it or upstream's recording cap stops it; that is
  the owner's choice.
- `changedBy` names the Gateway's one device label for every operator the Gateway admits.
- A member still on 3.15.x answers host speech as Collie 1.19 does; levelling every member removes it.
