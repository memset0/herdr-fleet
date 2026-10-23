## Context

The terminal surface (`web/src/components/fleet-terminal.tsx`) builds an xterm.js 6.0.0 terminal
with `scrollback: 0`. xterm 6.0.0 binds no touch handlers at all (its scrollable element and
selection service listen to mouse and wheel only), so a swipe on a phone reaches nothing.

xterm's wheel handling lives in `CoreBrowserTerminal.bindMouse`, as `wheel` listeners on the
terminal's element:

- When the active mouse protocol requests wheel events, the listener calls
  `coreMouseService.consumeWheelEvent` and, if it yields a non-zero amount, sends ONE report via
  `triggerMouseEvent` at the cell under `clientX/clientY`, encoded in the active protocol/encoding
  (X10, SGR, SGR-pixels, URXVT, …).
- Otherwise, when the buffer has no scrollback (always, here), it sends ONE `ESC [ A`/`ESC [ B`
  (or `ESC O A/B` under application cursor keys) per event with a non-zero amount.
- A read-only device's `disableStdin` drops both, through the emulator's own data path.

## Decisions

- **Route: synthetic `WheelEvent`s dispatched on `terminal.element`.** The public API has no
  "scroll the program" call (`scrollLines` moves local scrollback, which is empty), and the mouse
  service is private (`_core`). A dispatched wheel event enters the exact listener a desktop wheel
  does, so the protocol choice, the encoding, the cursor-key fallback, application-cursor mode and
  the read-only refusal are all xterm's — nothing is hand-encoded. The events are not `isTrusted`;
  xterm does not check that. Rejected: hand-encoding SGR/X10 sequences (duplicates xterm and goes
  stale on any protocol it adds); reaching into `_core.coreMouseService` (private, unpinned shape).
- **One event per step, in line mode.** Each step is `deltaY = ±1` with
  `deltaMode = DOM_DELTA_LINE`: `consumeWheelEvent` then returns `±scrollSensitivity` (1 by
  default), skipping the pixel-mode trackpad damping (×0.3) and partial accumulation that would
  otherwise swallow small synthetic deltas. Both xterm paths emit exactly one report or one key per
  event, so N steps are N events. No modifier keys are set (Shift would zero the amount).
- **Step size: one cell height of travel.** The cell height is the rendered screen's height divided
  by the row count (`.xterm-screen` is sized rows × cell height, line spacing included), falling
  back to font size × line height before the first render. The accumulator keeps the remainder, so
  slow and fast swipes give the same total.
- **Classification.** Nothing happens until the finger has moved past an 8 px slop; then the touch is
  a swipe if its vertical travel exceeds its horizontal, otherwise it is ignored for the rest of the
  gesture. A second finger at any point ends the swipe (pinch stays the browser's). Taps and long
  presses never pass the slop, so focus, the keyboard, the compatibility mouse events xterm selects
  with, and the existing copy-on-pointer-up are untouched — `touchstart` is never cancelled.
- **Position.** Reports carry the cell under the swipe's starting point, so a program with regions
  scrolls the one the finger landed on even if the finger drifts out of it.
- **Page scroll.** The host gets `touch-action: pan-x pinch-zoom` (the browser may still pan
  sideways and zoom, but never vertically over the terminal), and a non-passive `touchmove` listener
  calls `preventDefault` only while the touch is a swipe, for engines that honour `touch-action`
  partially. React's touch props are passive, so the listeners are added by hand on the host.
- **No momentum.** A fling would need a timer loop and its own cancellation rules; the owner
  marked it optional. Left out.
- **Pure logic in `fleet/ui/terminal/touch-scroll.ts`**: the gesture state (slop, classification,
  accumulation, direction), the cell-height rule and the wheel-event init. The component only feeds
  touch points and dispatches.

## Fork boundary

All paths are fork-owned (`fleet/**`, `web/src/components/fleet-terminal.tsx` and its test). No
invasive path changes. `FORK.toml` adds the new unit test to the terminal surface's `verify` list.

## Risks

- A future xterm release could add its own touch scrolling or change the wheel listener's target;
  the pin is exact (`6.0.0`), and the component test pins that wheel events are dispatched on the
  terminal element.
- iOS long-press text selection on the DOM renderer, followed by dragging a selection handle, may be
  read as a swipe once it passes the slop. Verified only on the owner's phone (task 3.2).
