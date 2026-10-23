## 1. Gateway diagnostics

- [x] 1.1 Timestamp every Gateway log line in its single log function.
- [x] 1.2 Close sessions with a reason (`restart`, `upstream-exit` with close code, `start-failed`, `grace-expired`, `evicted`) and log `terminal.session-ended` once; verify with focused session tests.
- [x] 1.3 End connections with `auth-ended`, `auth-expired` or `restart` and log `terminal.connection-ended` once; verify with focused connection tests.

## 2. Surface

- [x] 2.1 Show a closed-connection notice with a Reconnect button (ft() in every Fleet locale) that rebuilds the same Pane's connection in place; verify with focused surface tests.

## 3. Delivery

- [x] 3.1 Run focused tests, both typechecks, lint, `check-fork`, `check-private-facts` and strict OpenSpec validation.
- [x] 3.2 Deploy to the lead and confirm a timestamped `terminal.session-ended`/`connection-ended` line and an in-place reconnect.

Verification: 93 focused terminal tests (connection, session, spawn, service, route) and 36 web tests
(surface, Fleet i18n) pass; both typechecks, `check-fork`, `check-private-facts` and strict validation
pass; oxlint is clean on every file this change touches (the full-tree run's only findings belong to a
concurrent change's untracked `fleet/send-failure-screens*`).
