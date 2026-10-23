## Why

On a phone the real-terminal (ttyd) surface cannot be scrolled: the emulator is built without
scrollback and xterm.js has no touch scrolling of its own, so a one-finger swipe over the terminal
does nothing for the program on the other end. The owner wants a swipe to reach the remote program as
scrolling, exactly as a desktop mouse wheel already does.

## What Changes

Baseline: Collie v1.23.3 as recorded in `UPSTREAM.md`; Fleet 3.24.1.

- A vertical one-finger swipe over the terminal surface is turned into mouse-wheel input, one wheel
  step per cell height of finger travel, in the phone's natural direction (finger up = content moves
  up = wheel down).
- Each step goes through the emulator's own wheel path, so what the remote program receives is what a
  desktop wheel sends: a mouse-wheel report in the program's mouse protocol and encoding when it
  tracks the mouse, and the emulator's own up/down cursor-key fallback when it does not.
- While such a swipe is in progress the page itself does not scroll; a tap, a pinch, a long press and
  a mostly horizontal swipe are left to the browser as before.

Non-goals: no momentum (fling) scrolling; no local scrollback; no change to desktop mouse or wheel
behaviour, the mirror surface, the composer, the take-over or reconnect notices, or any server path.

Reused upstream behaviour: none changed — this is the fork's own terminal surface. The wheel
encoding and the alternate-screen fallback are xterm.js 6.0.0's own, not reimplemented.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-pane-terminal`: a touch swipe scrolls the remote program through the terminal's wheel input.

## Impact

Fork-owned only: new `fleet/ui/terminal/touch-scroll.ts` (+ test), `web/src/components/fleet-terminal.tsx`
(+ test), `FORK.toml` (the new test joins the terminal surface's verify list; the path is already owned
under `fleet/**`), `CHANGELOG.md`. Frontend bundle only, so a PATCH.
