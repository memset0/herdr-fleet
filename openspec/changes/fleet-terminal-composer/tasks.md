## 1. Send helper

- [x] 1.1 Pure helper: paste payload (bracketed only when enabled, markers stripped, `\r` line breaks), 4 KiB chunking, the bounded pacing delay, and the send sequence; `TerminalLink.type` reports acceptance. Verify with focused unit tests.
- [x] 1.2 Browser-local shown/hidden store with try/catch; verify with unit tests.

## 2. Surface

- [x] 2.1 Toggle in the terminal surface's top row and the box under the terminal (Collie's `ChatInput`, ft() in all seven Fleet locales), hidden on read-only devices; verify with component tests for persistence, send-disabled-when-not-ready, and clear-after-send.

## 3. Delivery

- [x] 3.1 Run focused tests, both typechecks, `bun run lint`, `check-fork`, `check-private-facts` and strict OpenSpec validation.
- [ ] 3.2 Deploy to the lead and try a long prompt into Claude Code and Codex from the box.
