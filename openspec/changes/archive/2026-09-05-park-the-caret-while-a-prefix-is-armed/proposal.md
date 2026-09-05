## Why

A prefix sequence does not complete while a Chinese input method is on. `Ctrl+B` arms, and then the
`N` of `Prefix+N` never reaches the recognizer as a usable key: the IME claims it to begin a
composition, and what the page sees is either nothing at all or a keydown carrying no physical code.
Every prefix binding that ends in a plain letter is affected — `Prefix+S`, `Prefix+C`, `Prefix+R` —
which is most of the shipped set. Direct chords are not, because a modifier chord is never composed.

The recognizer knows nothing about composition. Collie's own direct-typing hook does — it reads
`isComposing` and tracks `compositionstart` — so the precedent for handling this is already in the
tree, and the keyboard layer simply never grew it.

## What Changes

- **While a prefix is armed, the caret is parked** on a non-editable element. An IME composes into a
  focused editable target; with none, the second chord arrives as an ordinary keydown.
- **The caret is remembered at ARM time and restored when the sequence ends** — on a command, on
  Escape, on an unregistered key, and on the two-second expiry. It goes back to the offset it was
  taken from, through the module that already knows that rule.
- **Never mid-composition.** If a composition is already in flight when the prefix arms, the caret
  stays where it is; parking would commit or drop a half-typed word.
- **Parking gets its own timer.** The recognizer's expiry is lazy — it is noticed on the next key, so
  an armed prefix that is simply abandoned would leave the caret parked indefinitely.
- **A Fleet panel opened from a prefix command restores to the composer**, not to the parked element.

Accepted, explicitly, by the owner: **an unregistered second chord loses one character.** Today that
keystroke is not consumed and lands in the draft; parked, it lands nowhere. No synthesised
replacement keystroke will be produced — a synthetic key event is untrusted and inserts no text.

Non-goals: no change to which chords are bound, to the prefix timeout, to the hint panel, or to what
any command does. Nothing here is conditional on the operator's input method — parking is
unconditional while armed, because detecting an IME is not something a page can do.

## Capabilities

### Modified Capabilities

- `fleet-keyboard-commands`: what happens to the caret while a prefix is pending.

## Impact

- Fork-owned: `web/src/lib/fleet-composer-focus.ts`, `web/src/components/fleet-commands.tsx`,
  `web/src/components/fleet-panel.tsx`.
- Upstream-owned: none.
- **A premise this rests on, stated plainly:** parking helps only if the IME composes into the focused
  element rather than swallowing keys at the framework level regardless of focus. If it is the latter,
  this changes nothing about the reported symptom and the approach needs rethinking. It is worth doing
  either way — an armed prefix that preempts text input is what the capability already promises — but
  the IME fix specifically is contingent on that.
