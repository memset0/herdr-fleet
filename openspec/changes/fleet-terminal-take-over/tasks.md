## 1. Gateway

- [x] 1.1 Admit `takeover=1` (refuse other values) and carry it beside the target to the connection.
- [x] 1.2 `Session.attach` take-over: displace with notice `taken`, keep the same session/upstream, log `terminal.session-taken`; verify focused session and connection tests (swap keeps upstream, no intent stays busy, displaced client gets `taken`).

## 2. Surface and rule

- [x] 2.1 Busy notice offers Take over (ft() in all seven locales); `taken` gets its own sentence; verify a component test for busy → Take over.
- [x] 2.2 Restate the ADR 0008 departure rule in `AGENTS.md`.

## 3. Delivery

- [x] 3.1 Run focused tests, both typechecks, `bun run lint`, `check-fork`, `check-private-facts` and strict OpenSpec validation.
- [ ] 3.2 Deploy to the lead and take a terminal over between two browsers.
