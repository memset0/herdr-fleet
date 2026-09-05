## Context

The manual Pane fit is a fork feature that reaches into Collie's bridge through a declared port. The
pack link is Collie's, and its federated surface is a closed allowlist in `bridge/pack/forward.ts`
with a test that pins it to `bridge/server.ts`'s own route literals.

## Goals / Non-Goals

**Goals**

- A resize behaves the same wherever the Pane lives.
- The guard that should have caught this catches the next one.

**Non-Goals**

- Proxying `/pack/v1/config`, or otherwise making a per-host capability visible to the browser. Named
  in the proposal as a known gap, inert on this fleet, and a design question of its own.
- Any change to the measurement, the columns, or rows staying server-owned.

## Decisions

### Additive-optional, following `focus` exactly

§7.1 already has the shape for this and `focus` already used it: a new row in §5's table, no
`PACK_PROTOCOL_VERSION` bump, a lead that predates it never calls it and a peer that predates it
answers 404. The alternative — bumping the version — would declare every existing peer incompatible
over a route they simply do not have, which is what "additive-optional" exists to avoid.

The operational cost is real and belongs in the release notes rather than in the code: **a resize
across the link works only once the peer is running this**, so this is a MINOR on the release axis,
not a PATCH.

### The guard reads every declaration, not one

This is the actual repair. The drift test read `PANE_ROUTE` by name, so the fix that merely adds
`resize` to the allowlist leaves the hole exactly as wide as it was — the next route declared in a
literal of its own disappears the same way.

So the test now collects EVERY `const … = /^\/api\/pane\/…/` declaration in `server.ts`, takes the
union of the action segments they accept, and asserts each one is forwardable. A route declared in a
third literal is then visible to it. The expected set stays written down as well, so adding a route
fails here until somebody decides whether it should cross a link — a decision, not a bump, which is
the same posture as the pack-wire guard.

Two shapes have to be read, because both are in use: an alternation (`(reply|keys|…)`) and a plain
trailing segment (`\/resize$`).

### `focus` is corrected in the same commit

`forwardAuditAction` returned bare `focus` while the peer's handler writes `pane.focus`. It is the
same defect in the same table, one line from the one being fixed, and it makes the lead's line and
the peer's line disagree about what happened. Leaving it to be found again later would be worse than
the small widening of this change's scope; it is called out in the proposal rather than folded in
silently.

## Risks / Trade-offs

- **A peer that has not been levelled answers 404**, and the operator sees the same "could not be
  resized" they see today. No worse than the status quo, and it resolves on redeploy.
- **The refusal is still generic.** The browser cannot distinguish "this member is old" from "the
  mux refused"; making it distinguishable means a new error code across the link, which is a wire
  change this fix does not need.

## Migration Plan

Redeploy every member. Until a member runs this, a resize addressed to it fails exactly as it does
now — no partial state, nothing to undo.

## Open Questions

- How a per-host capability should reach the browser, so the resize control on a peer's Pane is
  decided by that peer. Stated as a non-goal above; inert while every member runs Herdr.
