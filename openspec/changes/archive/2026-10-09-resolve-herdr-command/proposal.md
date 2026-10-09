## Why

Fleet runs the multiplexer's own `herdr` command in three places: the lead Gateway's terminal
attach, the manual Pane fit controller, and a peer's terminal service. Each finds the command
differently. The peer terminal service consults only `PATH`, yet a plugin's children inherit the
Herdr server's environment, whose `PATH` need not contain the directory `herdr` was installed in.
Herdr does state its own binary as `HERDR_BIN_PATH` in that environment. On a member where `herdr`
sits outside the server's `PATH`, the peer terminal service therefore exits at every start, so that
member serves no browser terminal and answers every manual Pane fit with a failure.

## What Changes

- One fork-owned resolver decides which `herdr` executable Fleet runs: `HERDR_BIN_PATH` when it is
  set and names an executable file, otherwise the first `herdr` on `PATH`, otherwise a clear
  diagnostic naming both sources and why each was not used.
- The peer terminal service, the lead Gateway's terminal attach and its Pane fit controller, and the
  fit controller's own default all use that resolver, so the attach and the fit always drive the same
  binary on a machine.
- A peer whose resolver finds nothing still refuses to start its terminal service, now with the
  diagnostic rather than a bare "not installed".

Baseline: Collie v1.17.2, unchanged. This is a downstream fix in fork-owned code only.

## Non-goals

- Collie's own discovery of `herdr` (CLI, bridge, doctor) is upstream behavior and is not changed.
- No configuration key is added: the executable is never read from Fleet configuration or a request.
- The supervisor's restart policy for a child that fails at start is not changed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-plugin-runtime`: adds how every Fleet child resolves the multiplexer command it runs.

## Impact

- Fork-owned only: a new `fleet/herdr-command.ts` and its test; `fleet/terminal/peer-main.ts`,
  `fleet/gateway-main.ts`, `fleet/terminal/service.ts`, `fleet/terminal/spawn.ts`,
  `fleet/manual-pane-fit/controller.ts`. No upstream-owned path and no `FORK.toml` port changes.
- A peer executes this code, so it ships as a MINOR release and every member redeploys.
