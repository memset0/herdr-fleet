## Context

See `proposal.md` — Why. Three facts from the existing implementation shape this.

- The recognizer is a pure state machine behind ONE capture-phase listener, and the provider holds it
  in a ref. Nothing re-renders when a prefix arms today, which is why the pending state is currently
  invisible to React at all.
- The prefix expires after two seconds. Any delay before showing the panel is spent out of that
  budget, so it cannot be generous.
- `DESIGN.md` §2 — no state may move content — is the rule this feature is most likely to break: a
  panel that appears under the operator's hands on every prefix press is exactly the "state moved the
  page" failure that section was written about.

## Goals / Non-Goals

Goals beyond the proposal:

- Keep the derivation pure and in `fleet/ui/`, so what the panel lists is testable without a browser
  and cannot drift from what the recognizer would actually accept.
- Add nothing to the recognizer. The panel reads the same effective bindings the recognizer matches
  against; it does not ask the machine what it would do.

Non-goals beyond the proposal:

- No persistence, no preference, no per-operator dismissal. It is a hint about a state that lasts two
  seconds.

## Decisions

### It appears on a delay, and the delay is the feature

Showing it the instant the prefix lands would flash a panel on every single `Ctrl+B S` — a hundred
times a day for an operator who knows their keys, to tell them something they already know. That is
the same trade every prefix keyboard has already made, and they all made it the same way: wait, and
show it only to somebody who is actually waiting.

400ms. Out of a two-second budget that leaves 1.6s of visibility, which is the part that has to be
usable; and 400ms is comfortably longer than a deliberate two-key sequence takes to type, so the
operator who knows the key never learns the panel exists.

Alternatives rejected: showing it immediately (flashes constantly, and the flash lands under the
hands at the moment attention is on the keyboard), and showing it only on an explicit key (that key
is `Prefix+?`, which already opens the command bar — a second reference surface would be the same
information in two places).

### The panel reads the effective bindings, not the recognizer

`prefixHints()` takes the same `ReadonlyMap<CommandId, Binding[]>` the recognizer was built from,
keeps the `prefix`-kind bindings, and groups them. It does not consult the machine.

That is deliberate: the machine's job is to answer "does this key complete a binding", and a panel
that asked it "what keys would" would be a second interface on a state machine whose whole value is
having one. Reading the same input the machine reads keeps them in step by construction, and keeps
the derivation pure.

### It is a floating overlay with no space and no targets

Fixed to the bottom of the viewport, `pointer-events: none`, `aria-hidden`, no focusable child. Three
consequences, all wanted: it cannot move the page (§2), it cannot steal the second chord, and a
screen reader is not read a menu that is about to vanish.

Not being focusable is not an accessibility gap here — the panel is a redundant view of a keyboard
the operator is already using, and the same information is in the command bar, which IS a dialog with
proper focus and is reachable by the very prefix this panel is describing.

### It elides rather than scrolls

A scrollable hint panel is a contradiction: scrolling needs a pointer or focus, and the panel has
neither, so a row past the fold would be unreachable. It shows what fits in a bounded number of
columns and says how many it dropped. With the shipped defaults nothing is dropped; an operator who
binds fifty prefix chords gets the first n and a count.

## Risks / Trade-offs

- **The panel appears while the operator is reading the terminal underneath it** → it floats at the
  bottom edge, over chrome rather than over the mirror's tail, which is the same placement rule
  `DESIGN.md` §11 already settled for the status line; and it is gone within 1.6s.
- **A delay timer outliving its sequence would show a panel for a prefix that is no longer pending**
  → the timer is cleared on every outcome the machine reports and on every cancel path, and the
  panel renders from a single boolean the same handler owns.
- **Re-rendering the provider on every prefix press** → the panel's visibility is one boolean in the
  provider; the context value does not change, so no consumer re-renders because of it.

## Migration Plan

Nothing to migrate. The panel is derived entirely from bindings that already exist, and an
installation that changes nothing sees it describe the shipped defaults.
