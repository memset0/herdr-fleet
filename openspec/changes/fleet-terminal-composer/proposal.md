## Why

In the terminal (ttyd) surface the only way to type is the emulator itself, which is awkward on a
phone and for composing a long prompt. The owner wants an optional input box under the terminal that
looks like Collie's composer but writes straight into the attached terminal, without Collie's checked
send pipeline, which the owner finds too unstable for this surface.

## What Changes

Baseline: Collie v1.23.3 as recorded in `UPSTREAM.md`; Fleet 3.23.2.

- The terminal surface's own top row gains a toggle that shows or hides an input box under the
  terminal. The box takes layout space (the terminal refits), and the choice is remembered per
  browser.
- The box reuses Collie's `ChatInput` field and the composer box's look. Its send is Fleet's own:
  the text as a paste (bracketed only when the program enabled bracketed paste), split into bounded
  input frames, then Enter after a short pacing delay that grows with the text's size. No guard, no
  verification, no timeout. The draft clears only after every frame was handed to an open
  connection; Send is disabled while the terminal is not ready and the draft is kept.
- Keys follow Collie's composer: Ctrl/Cmd+Enter sends, Enter inserts a newline.
- Read-only devices get neither the toggle nor the box, as they get no keystroke path today.

Non-goals: no attachments, voice, suggestions, quick replies or send-mode menu; no change to
Collie's composer or send pipeline; no change to the Gateway or the browser↔Gateway grammar.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-pane-terminal`: an optional terminal-bound input box on the terminal surface.

## Impact

Fork-owned only: `fleet/ui/terminal/{composer,link}.ts` (+ tests), one new owned path in `FORK.toml`,
`web/src/components/fleet-terminal.tsx`, a new `web/src/components/fleet-terminal-composer.tsx`
(component cases in `fleet-terminal.test.tsx`), the seven Fleet locale files. Frontend only, so a PATCH.
