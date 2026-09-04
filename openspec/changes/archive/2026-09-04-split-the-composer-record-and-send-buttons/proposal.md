## Why

In the Collie v1.2.0 baseline this fork reapplies, the composer's microphone and its Send control
share one round button, and which one is drawn is decided by `input.trim() === ""`. So the microphone
exists only on an empty draft: the first transcript to land fills the box, the button hands itself
back to Send, and there is no way to dictate a second clip into the message being written. One
message gets one dictation.

That is upstream's deliberate trade — `abdbf45` ("the microphone is the primary button until you
type") removed a permanent in-field microphone to buy back the field's width, on the reasoning that
"nobody dictates a clause into a sentence they typed by hand". On a phone, dictating in turns is
exactly how a long reply gets written, and every mechanism the turn-taking needs is already built:
the transcript is spliced at the caret, hands-free withdraws itself on a non-empty draft, the
recorder survives typing, and `/api/stt` is a stateless one-shot. Only the entry point is missing.

## What Changes

- Give the microphone a control of its own, beside Send rather than instead of it, so a clip can be
  started at any point in a draft and dictation can be taken in turns.
- Remove the emptiness test that decides which control the shared slot draws. The trailing slot is
  Send whenever it is not one of the two confirm controls; the microphone is its own button ahead of
  it, drawn on the same condition that decides the feature exists at all.
- Refuse Send while a clip is live. Under one shared button this was structural — Send did not exist
  during a recording — and splitting the slot removes that guarantee, so it becomes an explicit
  refusal on every path that reaches a send, including the keyboard's.
- Refuse Send on a blank draft. `send()` already returns `false` for one, but the trailing control
  did not say so; with the microphone no longer standing in front of it, the enabled-but-inert state
  becomes reachable in the ordinary case.
- Record the widened composer port in `FORK.toml`, whose existing entry for this upstream file was
  written for a different port.

**Non-goals.** The recorder's own lifecycle is untouched: one clip at a time, discarded on a pane
switch, a composer lock or a hidden page. Hands-free keeps its existing rule — it applies only to a
transcript that meets an empty draft, so the second and later clips of a turn-taking draft insert
rather than send, which is the behavior that makes turn-taking safe. No new keyboard command, no
change to how a transcript is spliced, and nothing in `bridge/stt/`, `/api/stt`, the provider seam,
the capability probe or the recorder hook. No new operator setting.

## Capabilities

### New Capabilities

- `fleet-composer-voice`: how the composer's voice entry point is ranked against its send control —
  that dictation is repeatable within one draft, and what a live clip forbids.

### Modified Capabilities

None. `fleet-pane-chrome` governs the control row beneath the mirror and the header fixtures the
Pane route declines; the draft row's trailing controls are not among its requirements.

## Impact

- **Fork boundary.** `web/src/components/composer.tsx` is upstream-owned and already attributed to
  the `native-manual-pane-fit-port` entry, which the manifest requires to be its only entry. That
  entry's reason gains this port. `web/src/components/composer-stt.test.tsx` becomes a downstream
  path for the first time and needs its own attribution.
- **Upstream divergence.** This reverses a decision upstream made deliberately, so the next upstream
  sync will conflict here. The reason field is where a reader finds out why, rather than the diff.
- **Frontend only.** The change is confined to the web bundle, which puts the release on the PATCH
  axis: the lead alone redeploys and every viewer has it as soon as that machine is levelled.
- **Field width.** A second control in the draft row costs the field one button box and one gap.
  This is the cost upstream declined to pay; it is paid here knowingly, and the design records the
  measurement rather than leaving it to be rediscovered.
- **Docs.** `docs/voice-and-push.md` describes the shared-slot behavior and becomes wrong.
