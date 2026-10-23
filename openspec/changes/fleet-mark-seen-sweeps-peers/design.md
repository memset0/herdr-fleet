## Context

`markAllSeen` sends one seen read per pane, addressed by the pane's own scope; the crew forwarder
carries the seen header to the owning member, which stamps it. The shell then revalidates, and the
lead answers from its merged snapshot, whose peer half is the last-good body `CrewLead.sweep()`
banked on the last engine tick. `refreshNow()` deliberately skips a peer scope, and the lead's
`lookNow` only refreshes its own multiplexer.

## Goals / Non-Goals

**Goals:** a revalidation after Mark all seen reflects members' current seen stamps.

**Non-Goals:** changing per-pane open, the sweep cadence, or the crew protocol.

## Decisions

1. **Sweep inside `lookNow` on a lead.** `lookNow` gains `await crewLead?.sweep()` after it pokes the
   engine. A solo install and a peer have no `crewLead`, so their bytes and behavior are unchanged.
   Alternatives: a new "sweep" route (rejected: the requirement forbids a new route, and "look now"
   already means "show me the present"); a client-side seen overlay (rejected by the owner: one
   browser's rail only, and it contradicts the existing requirement).
2. **The shell calls `refreshNow()` with the lead scope** after the reads and before `revalidate()`.
   `refreshNow` already swallows failure, so a refused refresh degrades to today's behavior.
3. **Concurrency is upstream's.** `sweep()` returns at once when a sweep is already running; that
   sweep may have dialled the member before its seen read landed, so the next tick still settles it.
   Accepted: the common case is no sweep in flight.

## Risks / Trade-offs

- [Every foreground/visibility refresh on a lead now dials each member once] → the refresh route is
  already coalesced per session and a sweep is exactly the work each tick does; the extra cost is
  one tick's worth per operator act.
- [A slow member delays the refresh answer by its probe budget] → the budget is bounded below the
  poll interval by the settled multi-host rule; the shell keeps the control disabled while waiting.

## Migration Plan

Lead-only backend change: rebuild and restart the lead through the Herdr plugin's restart action;
members need nothing. PATCH release.
