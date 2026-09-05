## Why

A Pane page shows a *mirror* of a terminal: text polled over HTTP, rendered by Collie, replied to
through a composer. That is the right surface for watching an agent and answering it, and it is the
wrong one for the moments when the operator needs the terminal itself — a full-screen TUI, a
password prompt, a key sequence the composer has no word for, a program whose output does not
survive being re-fetched as lines. The fork already carries the evidence that this gap is real: the
previous generation shipped a separate browser terminal beside the app, on its own path, with its own
authentication, reachable only by leaving the application. It works, and nobody uses it, because it
is somewhere else.

This change puts that terminal *inside* the Pane page: same origin, same session, same rails, same
header, one switch. And it fixes the reason the previous generation's terminal was slow to move
between Panes — each visit re-attached from nothing — which is a property of where the connection
terminated, not of the terminal.

## What Changes

- Add a fork-owned terminal view for a Pane, rendered in place of Collie's mirror and composer while
  one global switch is on. Collie's own Pane page is not modified and is what renders when the
  switch is off.
- Add the first WebSocket surface in this product: an authenticated Gateway route that terminates a
  browser terminal connection, and originates its own connection to a `ttyd` running beside the
  Pane's real terminal. The browser is never `ttyd`'s client.
- Hold a terminal session open for a short bounded grace period after its browser leaves, so flipping
  between Panes and back does not re-attach. This is deliberately *not* a general warm-session cache:
  attaching was measured at roughly a tenth to a quarter of a second, and the multiplexer already
  repaints the whole screen on attach, so the expensive machinery a cache would justify is not
  warranted by what it would save.
- Add a peer-side terminal service: a Fleet child on a peer that resolves one of its own Pane ids to
  that Pane's real terminal id and starts exactly that terminal's `ttyd` on demand. A peer's terminal
  id cannot be resolved anywhere else — Collie drops it before Pack carries the Pane — so this is
  forced rather than chosen.
- **BREAKING (reachability grammar):** the one Peer-originated SSH link carries a third loopback
  projection, terminal-only. Its requirement today is "exactly two projections and no others", and a
  peer terminal has no other way to the Lead's Gateway: Pack forwards HTTP requests and cannot carry
  a stream.
- **BREAKING (schema 2):** `[transport]` gains the terminal projection's endpoints, and a peer gains
  its terminal service's bounds. Both tables reject unknown fields today, so neither is additive by
  accident.
- Make selected terminal text reach the operator's clipboard, and honour a clipboard request from the
  program running in the terminal. The previous generation could do neither: its terminal was framed,
  so a clipboard write from inside the frame had no permission to make one; the write it attempted
  used the deprecated document command from a selection-change handler rather than a user gesture,
  which browsers refuse; and no handler was registered for the escape sequence a program uses to ask.
  Owning the terminal surface makes all three ordinary rather than special.
- Restate, for this architecture, the boundaries the previous generation's terminal established:
  authenticated with no public bypass, closed by default, a fixed command with no browser-chosen
  terminal id, host, session or argument, and diagnostics that retain no terminal content, cookie or
  signing material.
- **Relax exactly half of one of those boundaries, and say which half.** The previous generation
  permitted one `ttyd` per device, serving one client. A `ttyd` runs a *fixed* command, so its
  terminal id is decided when it starts and one process can only ever serve one terminal: pooling
  several warm terminals means several `ttyd` processes on a device. That half is relaxed. The other
  half is not — each stays `--max-clients 1`, so "one writable client per terminal" remains enforced
  by `ttyd` itself rather than reimplemented above it. The alternative that would preserve one
  process per device is `--url-arg`, which lets the connecting side name the command's arguments;
  it stays off, because it would make the terminal id something a connection chooses.
- Reclaim idleness at two levels, because they are two different kinds of idle. A warm session whose
  browser has been gone for its own bounded interval is closed, taking its `ttyd` and its attachment
  with it. A device whose last session closed and that has been asked for nothing for a longer
  bounded interval — one hour by default — stops its terminal service entirely and returns to the
  process set it had before any terminal was ever asked for. The second level is what keeps "closed
  by default" true over time rather than only at startup.

Non-goals:

- Retiring the previous generation's terminal, its ingress, or its route. That lives in the consuming
  repository and is its own work.
- Any device, deployment, origin, or account fact. This repository's configuration grammar is
  specified here; every real value belongs to the consuming repository.
- Changing what Collie's mirror, composer, transcript, or Pack forwarding do. The switch chooses
  between two surfaces; it does not alter the one it is not showing.
- Read-only observation, session sharing, multi-writer terminals, and terminal recording.
- Enrolling a peer, or any change to Pack membership, identity, or trust. Reachability is transport.

## Capabilities

### New Capabilities

- `fleet-pane-terminal`: the browser-facing terminal — the global switch, the substitution of the
  Pane route's surface, the terminal's own rendering, input and clipboard, the authenticated
  WebSocket boundary at the Gateway, and the bounded grace period that makes flipping between Panes
  cheap.
- `fleet-peer-terminal-service`: the peer-side child that resolves a peer-local Pane id to its real
  terminal id, starts and stops exactly that terminal's `ttyd` on demand, answers a fixed control
  contract that cannot be asked for anything else, and stands itself down after a bounded idle
  interval so a device that is not being used holds no terminal machinery at all.

### Modified Capabilities

- `fleet-pack-reachability`: the single Peer-originated link carries a third, terminal-only loopback
  projection; "exactly two projections and no others" becomes an exact three, with the terminal
  projection's permitted contents stated so it cannot become a general forward.
- `fleet-runtime-configuration`: schema 2 gains the terminal projection endpoints in `[transport]`
  and the peer terminal service's bounds, under the existing strictness and unknown-field rules.
- `fleet-plugin-runtime`: the role-aware lifecycle supervises one more child on a peer, and the
  peer's process set is no longer Collie plus the link alone.
- `fleet-public-authentication`: the session boundary extends to a protocol it has never seen — a
  WebSocket upgrade — which must be authenticated before the upgrade completes rather than after.

## Impact

Collie baseline: upstream `AltanS/collie`, tag `v1.2.0` (tag object
`0f98f28c9aaadd641c4bc5ac484190ee3ef7008c`, commit `4618c90534d6f818ed6788b8db00e1582c5abfdc`).

Fork-owned, no upstream edit:

- `fleet/` gains the Gateway's terminal route, the session pool and replay buffer, the terminal
  client that speaks `ttyd`'s framing, the peer terminal service, and the Pane-id resolution that
  runs beside a real Herdr server.
- `web/src/components/` and `web/src/lib/` gain the terminal surface, its instance retention, and the
  global switch's stored preference.
- `fleet/pack-reachability.ts` and `fleet/config.ts` gain the third projection and its grammar.

Upstream-owned, ported: one path, `web/src/router.tsx`, which is claimed by no `FORK.toml` entry
today. The Pane route's element and loader become fork-owned wrappers that delegate to Collie's own
when the switch is off. `web/src/components/agent-chat.tsx` is deliberately **not** touched; it
already carries five ports, and the substitution does not need it.

Dependencies: one browser terminal renderer is added to `web/package.json`. `ttyd` itself is acquired
by the consuming repository and is not vendored here.

Measured, and the design rests on it: `ttyd 1.7.7-40e79c7` spawns its command once per WebSocket
connection — none while idle, one per client, and each client's child exits with that client while
`ttyd` itself survives. A browser connected directly would therefore re-attach on every Pane switch.
