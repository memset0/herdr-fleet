## Context

See proposal.md for why. Today the fit runs inside Collie: `bridge/server.ts` serves
`/api/pane/:id/resize`, `fleet/manual-pane-fit/action.ts` reads rows from the state engine's
server-only `viewportRows`, the crew router forwards `/crew/v1/pane/:id/resize`, and the browser asks
Collie's per-host mux capability table whether to offer the row. Fleet already has everything the
feature needs outside Collie: the Gateway's authenticated surface, `fleet/terminal/resolve.ts` (the
local snapshot resolver), the existing no-takeover controller (`fleet/manual-pane-fit/controller.ts`),
and the peer terminal service with its loopback projection and closed grammar.

## Goals / Non-Goals

**Goals:**
- Collie's tree returns to v1.17.2 bytes everywhere resize was the only reason for a hunk.
- Lead and member Panes are fitted by the machine they live on, with server-owned rows.
- The operator-facing row behaves as before.

**Non-Goals:**
- Changing the terminal surface's `attach --takeover` policy, the mirror, or Collie's capability rule.
- Automatic fitting, or takeover by the controller.
- A crew-link route, field or protocol bump.

## Probe: a retained controller beside `terminal attach --takeover`

Run on the lead against a throwaway workspace created for the probe and closed afterwards (Herdr
0.9.3); no existing Pane or session was touched and the server was not restarted.

1. A no-takeover `terminal session control <pane> --cols 100 --rows 30` answers a `terminal.frame`
   and the Pane's `viewport_rows` becomes 30.
2. `terminal attach <terminal> --takeover` from a 60x20 pty then **displaces the controller**: the
   controller writes `{"type":"terminal.closed","reason":"terminal attach taken over"}` and exits 0,
   and the Pane follows the attachment (20 rows). They do not coexist.
3. After the attachment ends the Pane stays at the attachment's size (20 rows); a controller that had
   been displaced is gone and does not come back.
4. While any client holds the terminal (attach or another controller), a second no-takeover controller
   is refused with `terminal.closed` reason
   `terminal attach failed: terminal <id> already has an attached client; retry with --takeover`.
   That wording names no "controller", so the existing conflict classifier missed it and called it a
   generic failure.
5. Closing the Pane ends a retained controller by itself: it writes
   `terminal attach ended: terminal <id> not found` and exits 0.

Design consequences:
- The resize row is a mirror row only (already the rule), so the two surfaces are never used for one
  Pane at once in normal operation. If the terminal surface's grace period still holds the Pane, a fit
  reports a **conflict** rather than taking the terminal back; the controller never uses takeover.
- A controller displaced by the terminal surface exits; the manager already forgets a lease on child
  exit, so the next fit simply acquires a new controller (or reports the conflict).
- "Released when the Pane goes away" needs no sweep or engine hook: Herdr ends the controller when
  its Pane closes and the exit handler drops the lease. Stopping the Gateway or the peer service
  releases the rest.
- The conflict classifier also recognises "already has an attached client".

## Decisions

**One shared local fit core.** `fleet/manual-pane-fit/local.ts` resolves `{pane, rows}` from one local
snapshot (exactly one match, `scroll.viewport_rows` positive) and drives the existing controller
manager. The Gateway uses it for lead Panes and the peer service uses it for its own Panes, so the two
machines cannot disagree about rows, bounds or failure reasons. `resolve.ts`'s snapshot shape gains
the optional `scroll` it already receives. Alternative: reuse Collie's state engine rows — rejected,
that is exactly the upstream coupling being removed.

**The Gateway route is its own module.** `fleet/manual-pane-fit/route.ts` validates the path, query
(`h`, `s` only, the terminal route's shapes) and body (`cols` only), dispatches lead vs member, and
returns the previous wire shape (`{ok:true, cols, rows}` / `{ok:false, error, reason}` with reasons
`unsupported | geometry | conflict | failed`) so the browser's result handling is unchanged. It is
mounted below the Gateway's session gate and its unsafe-method origin check, and joins the
machine-surface list so an unauthenticated call is a 401, not a login redirect. Its diagnostic line is
`herdr-fleet pane-fit.resize {...}` with pane, host, cols, rows and outcome. The named session `s` is
accepted for address parity with the terminal route and, as there, resolved against the one local
socket the Gateway owns.

**Members through the peer terminal service.** The lead POSTs `{pane, cols}` to the member's
`/terminal/resize` over the same loopback projection `peer-start.ts` already dials for close; the
member answers JSON. Nothing about rows or terminal ids travels. A member without a declared terminal
endpoint answers `unsupported` locally on the lead. Timeouts and non-JSON answers are `failed`.

**Availability is one Gateway read.** `GET /fleet/api/pane-fit` answers `{lead, members}`: whether the
lead can run `herdr`, and which member ids have a terminal endpoint. The browser hook reads it once per
document and caches it. A 404 (no Fleet Gateway, as in Collie's own suites, whose shared handlers learn
the 404) means the row is absent; a known Host without an endpoint shows the row disabled.
Alternative: keep Collie's capability table — rejected, it is the upstream port being retired, and a
member's mux being Herdr says nothing about whether the lead can reach its terminal service.

**A fork-owned hook carries the browser logic.** `web/src/components/fleet-pane-fit.tsx` exports
`useFleetPaneFit({...})` returning `{row, fit}`: `row` is the Display row element (or `undefined`),
`fit` the single function both the row and the `fit-pane-width` keyboard command call. Measurement
stays in `fleet/ui/manual-pane-fit.ts`. `agent-chat.tsx` keeps one hook call and passes `row` to the
existing `afterTextSize` slot; `display-prefs.tsx` keeps its one-line slot.

**Upstream deletions and FORK.toml.** Every hunk that only served resize is removed and each file is
restored to v1.17.2 where nothing else remains. Hunks that belonged to other ports stay and move into
entries that own them: the binding identity fields (adapter, mux types, engine, bridge and web types,
solo baseline, crew protocol note) join `terminal-binding-pin-port`; the `pane.focus` audit name gets
its own small entry; the CSP origin in `bridge/server.ts` joins `native-webfont-port`; the composer
moves to `composer-voice-rank-port`; the Codex padding skip joins `declined-centred-history-column`;
`FleetVersionView` joins `unnarrowed-pack-rows-port`. The server-only `viewportRows` field and its wire
strip existed only to feed the bridge route, so both go. `native-manual-pane-fit-port` keeps only the
slot in `display-prefs.tsx` and the Pane page (`agent-chat.tsx` and its test), which still carries the
other Pane-page ports it is attributed with.

## Risks / Trade-offs

- [A member not yet levelled answers 400 for an unknown path] → the lead reports an ordinary failed
  resize; the release is a MINOR so every member redeploys.
- [A retained controller on a peer keeps its terminal service from standing down] → intended; it ends
  when the Pane closes or the terminal surface displaces it.
- [Named sessions resolve against the Gateway's one socket] → the same limitation the terminal route
  already has; Pane ids are unique within that server's snapshot and exactly-one matching is required.

## Migration Plan

Cut as a MINOR. Deploy the lead, then every member. Rollback is per member: redeploy the previous tag;
a lead on this release with a member on the previous one gets a failed (not wrong) resize for that
member's Panes.

## Deployment finding (pre-existing, not caused by this change)

On one member the terminal service has failed to start since that member's Herdr server last
restarted: the plugin's children inherit the Herdr server's `PATH`, which does not contain the
`herdr` binary, and `fleet/terminal/peer-main.ts` looks the command up with `Bun.which("herdr")`
while ignoring the `HERDR_BIN_PATH` the runtime does provide. The service exits at startup, so that
member serves neither the terminal surface nor the new `resize` operation through the Gateway; the
lead reports an ordinary failed resize, as specified. The member-side fit core itself was exercised
against that member's own Herdr and fitted a throwaway Pane keeping its rows. The fix (honour
`HERDR_BIN_PATH` in `peer-main.ts`) touches code a peer executes and therefore needs its own MINOR;
it is left for a follow-up rather than folded into this released change.
