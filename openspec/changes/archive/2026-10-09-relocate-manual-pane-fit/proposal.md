## Why

Manual Pane fit is a downstream feature, yet on the Collie v1.17.2 baseline it is threaded through
roughly twenty upstream-owned files: a bridge route, a mux capability, server-owned viewport rows in
the state engine, a crew-link route and its protocol row, a browser API call, an acknowledgement entry
and a capability exception. Every upstream adoption has to re-review all of it. Fleet already owns a
Gateway, a local Herdr resolver and a peer terminal service that run beside Collie, so the feature can
live there and leave Collie almost untouched.

## What Changes

- The Fleet Gateway serves `POST /fleet/api/pane/:id/resize` (body `{cols}`, 20..500) behind its own
  session and same-origin rule, and records a Gateway diagnostic line instead of Collie's audit.
- For a lead Pane the Gateway resolves the Pane and its rows from the local Herdr server and drives the
  `herdr` CLI locally through a retained, no-takeover controller per socket and Pane.
- For a member's Pane the lead calls a new `resize` operation on that member's own terminal service;
  the member resolves its own Pane and rows and runs its own `herdr`. Nothing crosses the crew link and
  no Herdr socket is dialled across machines.
- The peer terminal service grows from three operations to four, and a held resize controller counts
  as activity, so the service does not stand down under it.
- Availability is Fleet's answer (the Host has a usable terminal endpoint), read from one Gateway
  read, not from Collie's mux capability table.
- The Display Settings `Resize` row, its `Custom` badge, its once-per-tap request and its fail-closed
  measurement are unchanged for the operator; the logic moves into a fork-owned hook, and upstream keeps
  only the `afterTextSize` slot and one hook call.
- **BREAKING (internal, upstream boundary)**: Collie's `/api/pane/:id/resize`, `/crew/v1/pane/:id/resize`,
  the `resizePane` mux capability, server-side `viewportRows`, and the browser `resizePane` API are
  removed. A lead on this release no longer forwards resize over the crew link; members must be levelled
  to this release to answer the new peer operation (a MINOR release).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-manual-pane-fit`: availability, write/audit/forwarding, and the rows-and-controller
  requirements move from Collie's bridge and crew link to the Fleet Gateway and the peer terminal
  service.
- `fleet-peer-terminal-service`: the closed contract gains a fourth operation (`resize`), and a held
  resize controller blocks stand-down.

## Impact

- Baseline: Collie v1.17.2, unchanged; this change only removes downstream hunks from upstream files.
- Fork-owned: `fleet/gateway.ts`, `fleet/gateway-main.ts`, `fleet/manual-pane-fit/**`,
  `fleet/terminal/resolve.ts`, `fleet/terminal/peer/**`, `fleet/terminal/peer-main.ts`,
  `fleet/ui/manual-pane-fit.ts`, a new fork-owned web hook component.
- Upstream files restored to v1.17.2 or reduced: `bridge/index.ts`, `bridge/server.ts`,
  `bridge/sessions.ts`, `bridge/mux/*`, `bridge/state-engine.ts`, `bridge/types.ts`, `bridge/crew/forward.ts`,
  `bridge/solo-baseline.test.ts`, `CREW_PROTOCOL.md`, `web/src/lib/{api,ack-manifest,mux-capability,types}.ts`,
  `web/src/components/agent-chat.tsx`.
- `FORK.toml`: `native-manual-pane-fit-port` shrinks; hunks of other ports move to their own entries.
- Non-goals: no automatic resize, no takeover by the controller, no change to the terminal surface's
  attach policy, no new crew-link field, no change to Collie's mirror.
