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

Settled during the merge; see "Merge resolutions".

### 3. Voice through the Gateway

Settled during apply; see "Voice, CSP and Gateway findings".

### 4. Overlaps

- Pairing names (1.20.0) refuse control and invisible characters; the Gateway's label is plain ASCII.
- The removed worktree routes and web pieces have no fork caller.
- The crew-peer update rollback fix and the Intel Mac payload live in `collie update` and release
  packaging; Fleet never invokes Collie's CLI against a deployment (ADR-level rule in AGENTS.md).
- None of the three upstream pull request branches (focus audit name, table corpus order, Codex
  headless status row) is fixed in `v1.20.1`; their ports stay.

### 5. Merge resolutions

Recorded during apply.

### 6. Entry review

Recorded during apply.

## Risks / Trade-offs

- A clip left recording runs until the operator ends it or upstream's recording cap stops it; that is
  the owner's choice.
- `changedBy` names the Gateway's one device label for every operator the Gateway admits.
- A member still on 3.15.x answers host speech as Collie 1.19 does; levelling every member removes it.
