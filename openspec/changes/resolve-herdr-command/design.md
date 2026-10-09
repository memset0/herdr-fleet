## Context

A Herdr plugin's processes inherit the Herdr server's environment. That `PATH` is whatever the server
was launched with, and on a machine where the server was started from a non-login shell or a service
manager it can omit the user's own binary directory. Herdr compensates by exporting `HERDR_BIN_PATH`,
the absolute path of its own executable, to plugin processes.

Before this change Fleet found `herdr` three ways: the peer terminal service with `Bun.which("herdr")`
only; the lead Gateway's fit with `Bun.which(HERDR_BIN_PATH || "herdr")`, which never fell back to
`PATH` when the stated value was unusable; the lead's terminal attach with `Bun.which("herdr")` only;
and the fit controller's default with the raw `HERDR_BIN_PATH || "herdr"` handed straight to `spawn`.

## Goals / Non-Goals

**Goals:** one resolver, one order (stated binary, then `PATH`), one diagnostic, and the same answer for
attach and fit on a machine. **Non-goals:** Collie's own discovery; any configuration key; supervisor
backoff for children that fail at start.

## Decisions

- **A pure, injectable resolver in `fleet/herdr-command.ts`.** It takes the environment, a `which`
  and an executable check, and returns either `{ path }` or `{ diagnostic }`. Injection keeps it
  testable with `bun test` without touching the real filesystem or `PATH`.
- **The stated binary is checked, not trusted.** It must be absolute and an executable regular file
  (`access(X_OK)` plus `isFile`). A stale value then falls back to `PATH` instead of producing a
  service that starts and fails at its first spawn.
- **`PATH` lookup goes through the inherited environment's `PATH`**, the same one the children run
  with, and its answer must be absolute, as before.
- **The lead's terminal tools take the resolved attach command as an input** rather than resolving
  `herdr` themselves, so `findTerminalTools` keeps resolving only the terminal server and the Gateway
  hands the same `herdr` to the terminal service and to the fit controller.
- **The fit controller's default uses the resolver too**, falling back to the bare name only when
  nothing resolves, where the spawn then fails closed exactly as before.

## Risks / Trade-offs

- A machine whose `HERDR_BIN_PATH` points at a different Herdr than the `PATH` one now runs the stated
  one. That is the binary Herdr itself declared, and the server the socket belongs to, so it is the
  more correct choice.
- The supervisor still restarts a terminal service that cannot resolve `herdr`; the diagnostic makes
  each such exit self-explanatory but does not reduce their number. Out of scope.

## Migration Plan

MINOR release; every member redeploys. No configuration or state changes. Rollback is redeploying the
previous tag.
