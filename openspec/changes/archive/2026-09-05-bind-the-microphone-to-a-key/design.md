## Context

Collie has no keyboard layer, so every part of this is downstream. The binding grammar, the
recognizer and the settings document are fork-owned; the recorder is not, and that is the one place
this touches an upstream file.

## Goals / Non-Goals

**Goals**

- Dictation reachable without moving a hand off the keyboard.
- A key that cannot act says why, in a sentence, and changes nothing.
- A modifier bindable as a key without making every other modifier binding unreliable.

**Non-Goals**

- Push-to-talk, tap-versus-hold, or any gesture beyond one keydown. Considered, and not built: it is
  a second grammar for one command, and the claim rule below makes a plain press sufficient.
- Any shipped default for the three commands. A key that opens a microphone is chosen, not inherited.
- Lifting the recorder out of the composer.

## Decisions

### A modifier fires on its own keydown, and a validation rule is what makes that safe

The recognizer used to ignore every modifier keydown, and the comment said why: pressing Alt to reach
`Alt+Q` would otherwise fire anything bound to Alt itself. That objection is exactly right and there
is no ordering that answers it — the bare press genuinely happens first, and the machine cannot know
whether a `Q` is coming.

So the document answers it instead. **Claiming a modifier as a key takes it out of circulation as a
qualifier**, and a document that does both is refused whole. The recognizer is then free to dispatch
the modifier's keydown, because nothing else can be waiting for that key.

The composition follows from what the spellings mean rather than from a table: a claim on `RAlt`
refuses `RAlt+Q` and `Alt+Q` — `Alt` means either, and either includes the right one — and leaves
`LAlt+Q` alone. Claiming both sides, or claiming the unsided `Alt`, refuses the family outright. The
prefix chord is checked alongside the bindings, because an operator who claims `LCtrl` while running
the default `Ctrl+B` prefix has silently broken every sequential binding they have.

The alternative was a tap detector: fire the bare modifier on keyup, only when no other key went down
in between. It works, and it is worse — it is a second timing rule to reason about, it fires late, it
behaves differently under an auto-repeat, and it still cannot tell a deliberate `Alt+Q` from a
mistyped one. The claim rule removes the ambiguity instead of arbitrating it.

### A browser reports THAT a modifier is down and never WHICH ONE

This is the hard fact under sided modifiers, and it shapes the implementation. The event for `Q`
pressed with the right Alt says `altKey: true` and carries nothing about the side. The only place a
side is observable is the modifier key's own event.

So the recognizer remembers which modifier codes are physically down, from their own keydowns, and a
sided requirement consults that set. Three consequences, each deliberate:

- **Without the set, a sided requirement matches nothing.** `chordMatchesEvent` takes it as an
  optional argument and defaults to empty, so a caller that does not track sides gets a binding that
  never fires rather than one that fires on the wrong key.
- **The set is cleared on blur and on the page hiding**, alongside the pending prefix. Every keyup
  between losing focus and regaining it happens somewhere else, so anything still recorded is a
  guess, and a stale side fires the wrong binding on the next press.
- **A page that gains focus with a modifier already held cannot know it.** The sided binding does
  nothing until that modifier is released and pressed again. Fail-closed, and the recovery is one
  keystroke.

### The refusal is a thrown error, not a returned value

Every adapter is `() => void | Promise<void>`, including the ones registered from Collie's own
components. Widening that to carry an outcome would put a Fleet-shaped return type on every call
site; throwing costs the one refusing adapter a line and everyone else nothing. The dispatcher
distinguishes a refusal from an ordinary throw by type, and reports them differently: a refusal is
the app working and gets the command's own sentence, a throw is the app breaking and gets "did not
complete" — never the exception's text, which is for a log and not for a person.

### The decision is pure and the composer is a call site

`decideMicCommand` answers what should happen and which refusal was hit. It lives in `fleet/ui/`,
where it is testable without a browser, a MediaRecorder or a provider — and where it is not logic
inside an upstream component. The composer maps a refusal to a sentence and calls the recorder it
already owns.

The registration has to be in the composer and nowhere else: the recorder is that component's state,
and lifting it so the shell could own the commands would move the microphone's whole lifecycle away
from the draft it writes into.

### The order the refusals are checked in

Whole-feature conditions first, then this moment, then this particular command. Being told "the
microphone is already recording" when the real problem is that the host has no API key sends the
operator looking in the wrong place; the host's own reason is shown wherever it gave one.

## Risks / Trade-offs

- **`RAlt` is a risky binding and is marked as one.** Where the right Alt is AltGr the browser reports
  Control alongside it, so the chord asks for a Control that is held and never matches. It fails
  silently-but-safely: nothing fires, rather than the wrong thing.
- **The claim rule can refuse a document that used to be accepted** — but only one that binds a bare
  modifier, which nothing could do before this change. No existing document can hit it.
- **A modifier's keydown now reaches the dispatcher.** With no bare-modifier binding present it
  matches nothing and is ignored, exactly as before; the change is only that the ignoring happens by
  finding no match rather than by returning early.

## Migration Plan

None. Every document written before this parses to the same bindings: an unsided modifier still means
either side, and a document with no bare modifier cannot hit the new conflict.

## Open Questions

None.
