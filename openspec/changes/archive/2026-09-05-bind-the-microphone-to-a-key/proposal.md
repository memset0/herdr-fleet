## Why

The microphone is a button and only a button. Everything else the composer does is reachable from
the keyboard; dictation — the one thing an operator most wants to start without moving their hands —
is not. And the reason it was not is real rather than an oversight: the keys worth binding it to are
modifier keys, and the grammar could not name one.

Three gaps, all of them in the way of the same request:

- The catalog has no microphone command at all.
- A binding cannot name a MODIFIER as its key, so `RAlt` is unwritable. The recognizer ignored every
  modifier keydown, deliberately, because otherwise pressing Alt to reach `Alt+Q` would fire it.
- A binding cannot name a SIDE. `Alt` means both, which is right as a default and useless when the
  right one is the key and the left one is still a modifier.

## What Changes

- **Three microphone commands** — start, stop and toggle — dispatched like every other command and
  listed in the palette. All three ship unbound: a key that opens a microphone is one the operator
  chooses.
- **A command may REFUSE**, and a refusal is not a failure. Every condition that greys the microphone
  button out becomes a sentence on the error channel: no provider, a locked composer, type-mode
  armed, a send in flight, a clip still transcribing, already recording, not recording. A refusal
  changes nothing — no recorder is created, none is stopped.
- **A modifier may be a binding's key.** `RAlt` is the right Alt key; `Alt` is either Alt.
- **A modifier may name a side wherever it appears.** `RAlt+Q` is the right Alt held over `Q`;
  an unsided `Alt` keeps meaning either, so nothing an operator has already written changes.
- **A modifier cannot be both.** Claiming one as a key takes it out of circulation as a qualifier,
  and the settings document refuses the pair. This is what makes firing on the modifier's own keydown
  safe, and it is the only thing that can: the bare press genuinely happens first, and no ordering
  in the recognizer can know whether a second key is coming.

Non-goals: no tap-versus-hold gesture, no push-to-talk, no default binding for any of this, and no
change to the microphone button or to what a finished transcript does.

## Capabilities

### Modified Capabilities

- `fleet-keyboard-commands`: the catalog gains the three microphone commands; the binding grammar
  gains sided modifiers and modifier-as-key; the dispatcher gains a refusal that is not a failure.
- `fleet-settings`: the document refuses a modifier that is claimed as a key and held as a qualifier.

## Impact

- Fork-owned: `fleet/ui/commands/bindings.ts`, `catalog.ts`, `recognizer.ts`, `effective.ts`,
  `refusal.ts` (new), `fleet/ui/mic-commands.ts` (new), `fleet/settings/document.ts`,
  `web/src/components/fleet-commands.tsx`.
- Upstream-owned: one `useFleetCommandAdapters` registration in `web/src/components/composer.tsx`,
  which is where the recorder's state lives, plus seven strings in the six dictionaries. The
  component gains a call and no logic — the whole decision is `decideMicCommand`. Recorded on the
  already-attributed `composer-voice-rank-port` entry.
- A document written before this change parses identically: every unsided modifier still means
  either side, and a document with no bare modifier in it can hit no conflict.
