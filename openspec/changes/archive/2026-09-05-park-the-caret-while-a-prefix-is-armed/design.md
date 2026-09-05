## Context

The keyboard layer already owns one focus module: `returnFocusToComposer` puts the caret back after a
command, at the offset it was taken from, or at the end of the field when the command moved the
operator to another Pane. It settles over a bounded window, gives up while a Fleet panel is standing,
and never takes the caret from an operator who has already started typing.

This change adds a third trigger to that module. It does not add a second focus system, and the whole
design is arranged so that it cannot become one.

## Goals / Non-Goals

**Goals**

- A prefix sequence that ends in a letter completes with a CJK input method on.
- The caret behaves afterwards exactly as it does today.

**Non-Goals**

- Detecting the operator's input method. A page cannot, so parking is unconditional while armed.
- Making the lost character reappear. Accepted by the owner; a synthetic key event is untrusted and
  would insert no text anyway.
- Any change to the prefix timeout, the hint panel, or what commands do.

## Decisions

### Parking, rather than reading the composition

The alternatives were considered and are worse. Matching on `key` when `code` is unusable does not
help when the event never arrives. Cancelling a composition from `compositionstart` is reactive — the
key has already been eaten by then, and there is no cancel API short of blurring, which is parking
arrived at late and messily. Requiring modifiers on second chords is a configuration workaround, not
a fix.

Parking removes the condition instead of arbitrating it: with nothing editable focused, there is no
composition to lose the key to.

### The caret is captured at ARM time, not at invocation

This is the part that would silently break the existing behaviour if it were missed. `invoke()` reads
the caret by asking whether the composer holds it — parked, it does not, so every prefix command
would answer `null` and land at the end of the field instead of where the operator was. So the arm
captures, and the dispatcher prefers what the arm remembered over what it can read.

A direct chord still captures at invocation: nothing was parked, and the live read is the accurate
one.

### Parking owns a timer, because the recognizer's expiry is lazy

The two-second window is enforced on the *next* key — a design that is right for the recognizer,
which is a pure machine over an injected clock and owns no timers. But an operator who arms the
prefix and then walks away produces no next key, so nothing would ever unpark. The provider already
runs a timer on arm for the hint panel and already has a single "the sequence ended" hook that every
outcome passes through; parking hangs off both rather than introducing a third lifecycle.

### The panel's restore target grows one exclusion

`FleetPanel` remembers what held the caret when it opened and gives it back on close, with
`document.body` already excluded as "nowhere". The parked element is the same kind of nowhere, so it
joins that exclusion and the panel falls through to the composer — with the arm-time offset, which is
why that value is readable from the module rather than only threaded through `invoke`.

### One character is lost, and it is written down

Today an unregistered second chord is deliberately not consumed, so it reaches the draft. Parked, it
reaches nothing. The owner accepted this explicitly. It is in the spec rather than only here, because
it is externally visible behaviour and the next person to read the requirement should not have to
discover it from a comment.

## Risks / Trade-offs

- **The premise may not hold.** If the input method framework claims keys regardless of which element
  has focus, this changes nothing about the reported symptom. It is still correct — the capability
  already promises that an armed prefix preempts text input, and this is what makes that true against
  an IME — but the specific bug would need a different answer.
- **The caret visibly leaves the box for up to two seconds.** Only while a prefix is pending, and the
  offset comes back. An operator who never uses the prefix never sees it.
- **A phone would find this violent** — blurring dismisses the soft keyboard. No phone sends the
  prefix chord, so the state is unreachable there; noted rather than guarded, because a guard would be
  untestable code for a case that cannot arise.

## Migration Plan

None. No configuration, no persisted state, no wire field.

## Open Questions

None. The premise question above is a risk with a known test, not an undecided design.
