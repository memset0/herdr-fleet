## Context

The terminal surface (`fleet-terminal.tsx`) owns a status row above the emulator and a retained
`TerminalLink` per Pane. Keystrokes go `terminal.onData → link.type → one input frame`. Collie's
composer (`composer.tsx`) is a large upstream component whose send is the checked Send Protocol
(`bridge/surface/protocol.ts`): it writes the text — a bracketed paste through the multiplexer where
the harness profile allows (`bridge/mux/types.ts` `pasteText`) — waits a per-profile
`paste.settleMs` (350 ms for a pane with no profile; Claude and Codex send Enter about 85 ms after
the text), then verifies. That verification is what this surface deliberately does without.

## Decisions

- **Toggle in the surface's own top row, not Collie's header.** The header's right cluster is
  upstream's single ⋮ by design; the terminal surface's status row is fork-owned and is already its
  toolbar. The toggle is `ui/toggle-button.tsx` drawn at 20px with a 44px hit area (DESIGN.md §6),
  so the row stays thin. It and the box leave with the row in zen.
- **Reuse Collie's field, not its component.** `ui/chat/chat-input.tsx` gives the autosize, the
  one-line placeholder contract and the viewport-relative cap; the box copies the composer box's
  frame classes and Send button shape. Importing `composer.tsx` would import its send pipeline.
- **Paste like xterm, but chunked.** `terminal.paste()` emits ONE data event, i.e. one frame of
  unbounded size, and the Gateway queues at most 8 KiB of input while still establishing. So the
  helper reproduces `paste()` itself: line breaks become `\r`, any paste markers inside the text are
  removed, the payload is wrapped in `ESC[200~ … ESC[201~` only when
  `terminal.modes.bracketedPasteMode` is on, encoded, and written in 4 KiB frames through the same
  `link.type` the keyboard uses. Order is the socket's order.
- **Enter is paced, not checked.** `\r` is written after `min(1000, 80 + 10 × KiB)` ms (KiB rounded
  up): 80 ms is about where Collie's checked send lands Enter for Claude and Codex, and the per-KiB
  term gives a large paste time to be taken in before Enter. Nothing is read back.
- **Ready means output has arrived.** Send is enabled once the socket is open AND the first output
  frame arrived, which the Gateway sends only after attaching — so a send never lands in the 8 KiB
  establishment queue. A closed link refuses writes; `link.type` now reports whether it accepted the
  frame, and the draft clears only if every frame and the Enter were accepted.
- **Keys are Collie's.** Collie's composer sends on Ctrl/Cmd+Enter and leaves Enter as a newline
  (its `ChatInput` sets `enterKeyHint="enter"` for that reason), so this box does the same; IME
  composition never sends.
- **Persistence** is one browser-local boolean (`herdr-fleet:terminal-composer:v1`) behind the same
  try/catch store shape as the surface switch.

## Risks / Trade-offs

- Without verification a send into a program that is not ready to take input is simply typed there;
  that is the owner's stated trade.
- A program that does not enable bracketed paste receives the text as typed keys, so each line break
  submits a line, as a real terminal paste would.
