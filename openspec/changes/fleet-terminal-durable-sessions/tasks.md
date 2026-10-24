## 1. Gateway

- [x] 1.1 Pure `fleet/terminal/early-exit.ts`: window (5 s), byte bound, 300-character tail, the escape/control sanitizer and the `EarlyTail` capture that discards itself once the window passes; verify with `fleet/terminal/early-exit.test.ts` (CSI/OSC/DCS/incomplete sequences, C0/C1, whitespace, truncation, UTF-8 split, window expiry).
- [x] 1.2 Limits: grace 1 h (bound 6 h), eight sessions (≤ the member's default server maximum), honest doc comment; eviction prefers the LRU session with no browser and falls back to the LRU attached one; verify with `service.test.ts` and `session.test.ts` cases.
- [x] 1.3 Session: capture output into the early tail, log `early`/`ms`/`tail` on an early `upstream-exit` only, and hand the tail to the attached client; verify with `session.test.ts` (early exit with tail, late exit with none, nothing retained after the window).
- [x] 1.4 Connection and grammar: `TO_BROWSER.exit` frame sent before the `ended` notice on an early exit; verify with `connection.test.ts` and `browser.test.ts`.

## 2. Surface

- [x] 2.1 Pure `fleet/ui/terminal/recover.ts` backoff (1, 2, 4, 8, 15, 30… s within 180 s) and `TerminalLink.onEarlyExit`; verify with `recover.test.ts` and `link.test.ts`.
- [x] 2.2 Surface: closed state owned by the retained entry through a mount-installed hook; automatic retry with a reconnecting notice and the tail; manual Reconnect cancels and restarts the run; a stable connection ends the run; budget spent shows the keeps-exiting notice; visibility return reconnects an ended surface; three new Fleet strings in all seven locales; verify with `fleet-terminal.test.tsx` cases.

## 3. Delivery

- [x] 3.1 FORK.toml verify lists name the new tests; CHANGELOG `[Unreleased]` lines; run focused tests, both typechecks, `bun run lint`, `bun scripts/check-fork.ts`, `bun scripts/check-private-facts.ts` and `openspec validate --strict`.
- [ ] 3.2 Owner check on the lead: leave a terminal for more than twenty seconds and come back to the same session; when an early exit recurs, confirm the tail appears in the Gateway log and on screen, that the surface recovers by itself, and that a page brought back to an ended terminal reconnects.
