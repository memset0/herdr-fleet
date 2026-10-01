## Context

How Collie tracks "seen" (read at `v1.15.0`):

- The bridge keeps two stamps per pane in `ActivityLedger` — `activeAt` and `seenAt` — and the
  snapshot reports them as `lastActiveAt` / `lastSeenAt`. Nothing stores a "seen" flag.
- `isUnseen` (`web/src/lib/triage.ts`) derives unseen on the client: a non-shell pane whose status
  is `done` or `idle` with `lastActiveAt > lastSeenAt`. The dashboard's counts, its Ready·unseen
  section, the rail's summary line and the row's square all read it.
- `seenAt` moves only in the pane route (`bridge/server.ts`): a write action, or a READ carrying the
  `x-collie-seen` header (`marksPaneSeen`). The header is the CSRF proof that the read came from
  Collie's own page — a no-cors cross-site request cannot set a custom header — so a guessed
  `<img src=/api/pane/…>` cannot clear the operator's alerts.
- The client sets it in `fetchPane` (`web/src/lib/api.ts`) unless `seen: false` (the pointerdown
  prefetch). There is no `markSeen` export, no batch route and no POST for it.
- A peer's pane is addressed by `?host=` (and `?session=`); the lead's crew forwarder copies
  `x-collie-seen` through (`bridge/crew/forward.ts`), and the peer stamps its own ledger.
- The fork's Gateway rebuilds upstream headers from an allowlist (`fleet/proxy.ts`) that does not
  include `x-collie-seen`, so behind the Gateway reads never mark seen.

## Goals / Non-Goals

**Goals:** one tap clears every unseen mark in the rail's roster across hosts, through Collie's own
per-pane signal; the result is what Collie itself would record had the operator opened each pane.

**Non-Goals:** a new route or batch endpoint, a client-side "seen" overlay, any change to `isUnseen`.

## Decisions

1. **The primitive is a seen read per pane.** `markPanesSeen(panes, scopeOf, read?)` in fork-owned
   `web/src/lib/fleet-mark-seen.ts` calls `fetchPane(paneId, 1, scope)` for each unseen pane — the
   seen header set by upstream's own client, the smallest read the bridge accepts (`lines=1`). The
   ETag cache entry it leaves is keyed and validated by content, so the pane page's next full read
   cannot 304 into a one-line mirror (the bridge's ETag is the body's hash). Alternative rejected: a
   POST to a fork route — seen is Collie's state, and a write route would need its own CSRF story.

2. **A small parallel batch, failures tolerated.** Up to four reads in flight at a time; each read
   that fails (a pane that closed, an unreachable peer) is skipped. The pane stays unseen and the
   control keeps showing it after the revalidation, which is the honest outcome.

3. **Address from the row.** Each read is scoped with `paneScope(data.scope, agent, data.servers,
   data.sessions)` — the same function the rail's own open uses — so a peer's pane is read on its own
   host and session and never on the lead's identically numbered pane.

4. **The rail draws, the shell acts.** The rail stays a props-only component: it takes an optional
   `onMarkAllSeen(panes)` returning a promise, and draws the control only when that prop is present
   and its roster holds an unseen pane. The shell supplies a stable callback that runs the batch and
   then awaits `revalidate()`. The rail keeps `busy` state from the tap until that promise settles,
   so the control is disabled through the reads AND the revalidation and does not flash back with the
   old count in between. Because the same memoised element is the Pane page's switcher content, the
   phone's sheet gets the control unchanged.

5. **Placement and look.** The summary line and the control share one wrapping row: the line keeps
   its slot and the control sits at the row's trailing end as a small outline button (the `Button` primitive,
   `size="sm"`), with Collie's unseen square and the count, so it reads as acting on what the square
   marks. Its accessible name states the count in words (`tn` plural keys). It is hidden — not merely
   disabled — when nothing is unseen, per the request. At the rail's default width the summary line
   and the labelled control do not fit on one line (checked over CDP at 1600 and 390 wide), so the
   control wraps beneath the line, and when it goes the rows below move up by its height. Accepted:
   the summary line never moves, the movement follows the operator's own tap and confirms it, and an
   icon-only control or a permanently reserved line would trade away either the requested label or
   40px of every rail. A wider rail holds both on one line.

6. **Gateway allowlist.** `x-collie-seen` joins `REQUEST_HEADERS`. It carries no credential and no
   identity; forwarding it keeps Collie's same-origin proof intact, because a cross-site request to
   the Gateway cannot set it either, and every forwarded request has already passed the Gateway's
   session check. Without it this control and every ordinary pane open behind the Gateway mark
   nothing.

## Risks / Trade-offs

- Each read refreshes one entry of the 20-entry pane cache; marking many panes may evict other
  panes' bodies, costing one full re-read when they are next opened. Accepted.
- A pane that finishes again between the tap and the revalidation is reported unseen again, as
  Collie would report it.
- The Gateway change runs on the lead only (PATCH axis).
