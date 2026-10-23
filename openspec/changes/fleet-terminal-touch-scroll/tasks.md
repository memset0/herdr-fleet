## 1. Gesture logic

- [x] 1.1 `fleet/ui/terminal/touch-scroll.ts`: slop, vertical classification, multi-touch abort, per-cell accumulation with remainder, natural direction, cell-height rule, line-mode wheel init; verify with `touch-scroll.test.ts`.

## 2. Surface

- [x] 2.1 Wire non-passive touch listeners on the terminal host: dispatch one wheel event per step on `terminal.element` at the swipe's start point, `preventDefault` only while swiping, `touch-action: pan-x pinch-zoom`; verify a component test (swipe dispatches steps, tap and sideways swipe do not).
- [x] 2.2 `FORK.toml` verify list, `CHANGELOG.md` Unreleased line.

## 3. Delivery

- [x] 3.1 Run focused tests, both typechecks, `bun run lint`, `check-fork`, `check-private-facts` and strict OpenSpec validation.
- [ ] 3.2 Owner check on a phone: swipe scrolls a mouse-tracking program and a full-screen program without mouse tracking; tap/keyboard, pinch, sideways swipe, selection/copy and the notices still behave.
