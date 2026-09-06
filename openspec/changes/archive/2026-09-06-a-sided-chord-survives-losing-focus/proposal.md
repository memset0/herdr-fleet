## Why

`LAlt+Q` never fires. Not intermittently — never, on the machine it was reported from, with the left
Alt, from a document that parses and reaches the browser.

The cause is one line of misplaced prudence. A browser reports THAT a modifier is down and never
WHICH ONE, so a sided chord can only work if the recognizer saw that side's own keydown and
remembered it. It did — and then threw it away on `blur`, reasoning that a keyup arriving while the
page is unfocused is one it would never see, so anything still recorded is a guess.

**Pressing `Alt` blurs the window on some platforms** — it moves focus to the menu bar — and it does
so BETWEEN the modifier's keydown and the key it qualifies. So the side was recorded, wiped, and the
chord matched nothing. Every time. The defence fired on exactly the sequence it was defending.

## What Changes

- The recorded sides are **not** discarded when the page loses focus or is hidden.
- Every key event **reconciles** the recorded set against its own modifier flags first: a family the
  event reports UP cannot have either of its sides held, and that is a fact rather than an inference.
  A side genuinely released is dropped on the very next key.
- A side nobody ever saw pressed still refuses rather than guessing — the page focused with the
  modifier already down cannot know which one it is, and firing the wrong binding is worse than
  firing none when one keystroke recovers it.

Non-goals: no change to the grammar, to which chords are bound, to the claim rule, or to unsided
modifiers, which never consulted the recorded set at all.

## Capabilities

### Modified Capabilities

- `fleet-keyboard-commands`: a sided chord's reliability across a focus change.

## Impact

- Fork-owned: `fleet/ui/commands/recognizer.ts`, and two helpers exported from
  `fleet/ui/commands/bindings.ts` that the reconciliation reads.
- Upstream-owned: none.
- No document changes: every binding an operator has written keeps its meaning, and the ones that
  were silently dead start working.
