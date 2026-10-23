## Why

The Pane's real-terminal surface sometimes shows "ended" and stays dead. The Gateway log records a
grace expiry or an eviction without a time, and records nothing at all when a browser's connection
ends because of a restart, an upstream attachment that exited, or an authenticated session that was
revoked or expired, so the cause cannot be diagnosed. The surface then offers no way back except
leaving the page.

## What Changes

Baseline: Collie v1.23.3 as recorded in `UPSTREAM.md`; Fleet 3.23.2.

- Every terminal end is logged once by the layer that decided it, with a closed-vocabulary reason:
  `restart`, `upstream-exit` (with the upstream socket's close code when there is one), `start-failed`,
  `grace-expired`, `evicted` for a session; `auth-ended`, `auth-expired`, `restart` for a browser
  connection. Lines carry the placement label existing events already use.
- Every Gateway log line carries an ISO-8601 timestamp, added once in the Gateway's single log function.
- A closed connection shows a notice box with a keyboard-accessible Reconnect control that establishes
  a fresh connection for the same Pane in place.

Non-goals: no change to the browser notice vocabulary or wire grammar; no reason crosses to the browser;
no automatic reconnect; no change to `busy` semantics (a second browser is still refused, never
displaces the first, and takeover is never a duplicate-start fix); no change to the peer terminal
service or its log; no terminal stderr or output is captured.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-pane-terminal`: diagnostics name why a terminal ended and when; the surface can reconnect in place.

## Impact

Fork-owned only: `fleet/gateway-main.ts`, `fleet/terminal/{session,connection,spawn,service}.ts` and
their tests, `web/src/components/fleet-terminal.tsx` and its test, the Fleet locale files. No
`FORK.toml` change. Gateway and frontend only, so a PATCH: the lead alone redeploys.
