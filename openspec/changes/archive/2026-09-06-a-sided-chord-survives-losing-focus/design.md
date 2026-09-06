## Context

Sided modifiers were added two days ago so `RAlt` could be bound to the microphone and `LAlt+Q` to
the switcher. The matcher, the grammar and the recognizer were each covered by tests, and a sided
chord driven from a real settings document was covered too. All of them passed. The binding still did
not work in a browser.

## Goals / Non-Goals

**Goals** — a sided chord that works as reliably as an unsided one, and a staleness rule that is a
fact rather than a precaution.

**Non-Goals** — guessing a side that was never observed; changing the grammar or any binding.

## Decisions

### Reconcile from the event, rather than forget on blur

The old rule discarded the recorded sides whenever the page lost focus, reasoning that a keyup
arriving while unfocused is one that would never be seen. That reasoning is sound and the conclusion
was wrong, because it ignored WHEN focus is lost: on some platforms pressing `Alt` is itself what
moves focus to the menu bar, and it does so between the two keydowns a sided chord is made of. The
guard fired on precisely the sequence it existed to protect.

The replacement uses something better than a precaution. Every key event carries the full modifier
state, so a family an event reports as up cannot have either of its sides held — that is a fact the
browser is asserting, not an inference from what we happened to observe. Reconciling on every event
therefore drops a genuinely released side on the very next key, which is both sooner and more
accurate than dropping it on a blur.

What remains stale is narrow and bounded: a side can only be wrong while its family is genuinely
still down, so the worst case is firing the same-family chord for the other side rather than firing
something unrelated. Against that: the previous behaviour was that the binding never worked at all.

### A never-observed side still refuses

Focusing a page with `Alt` already held leaves the side genuinely unknowable. Firing anyway would run
a binding the operator did not press, and the recovery from refusing is one keystroke. So this case
keeps failing closed, and the requirement says so rather than leaving it to be rediscovered.

### Why no test caught it

Every existing test drove the recognizer as a sequence of key events with nothing between them, which
is the shape a test naturally takes. The bug lives in what happens BETWEEN two keys, and nothing had
ever put anything there. The regression test now does exactly that, and reads as the sequence a
person performs rather than as an internal call.

## Risks / Trade-offs

- **A stale side can survive a genuine release if no further event ever reports the family up.** In
  practice the next keystroke does. The bound is the family being held, so the error can never reach
  a different modifier.
- **Two windows, two Alts.** Holding left Alt here, switching away, holding right Alt there and
  returning to press the key would fire the left-hand binding. Vanishingly rare, and the alternative
  it replaces is the binding never working.

## Migration Plan

None.

## Open Questions

None.
