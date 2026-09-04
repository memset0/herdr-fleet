## Context

See `proposal.md` — Why. Both corrections come from using the commands rather than from reading
them, and both are cases where the first implementation reached for the wrong existing thing.

## Goals / Non-Goals

Goals beyond the proposal:

- Make the rename input the SAME panel as the command bar by construction — one shell component —
  rather than two sets of classes that happen to match today.
- Spend no new invasive path. Both corrections should reduce the fork's surface, not grow it.

Non-goals:

- A general dialog framework. Two surfaces share one shell; a third can join when it exists.

## Decisions

### The panel shell is promoted, not copied

`DESIGN.md` §1 says to look for the primitive and to promote one the moment a second place needs the
same visual idea. A second place now does. The command bar's outer structure — the dim, the
top-anchored card at a bounded width, the ground and the rule — becomes `FleetPanel`, and both the
bar and the rename input render inside it.

It is promoted into a fork-owned component rather than into `components/ui/`: that directory is
Collie's, and a shell that exists only to serve two fork surfaces would be a wider claim on it than
the two surfaces justify.

### The rename input owns its mutation, and only its mutation

The dialog calls the same `renameTab` / `renamePane` client functions the action sheets call, keeps
each target's existing meaning for a blank value, and reports through the same status channel. What
it does NOT take from the sheets is their presentation, which is the whole point of the change.

The duplication this creates is two call sites for one client function, which is the ordinary shape
of two surfaces offering the same action. The alternative — driving the sheet's internal rename mode
from outside — would couple the keyboard to another component's private state, which is a far worse
trade than calling the same function twice.

Closing stays with the sheets. A close needs a confirmation with blast-radius text, and that is
exactly what the sheet already is; there is nothing about `Escape`-and-`Enter` that makes a
destructive confirmation better in the middle of the screen.

### `create-tab` uses Collie's flow because of what the flow carries

The direct API call was not merely less tidy — it was missing the fresh-Pane handoff, which is why
the command appeared to do nothing. Collie's `useSpaceActions().newTab` was written for exactly this
("the new pane won't be in the snapshot until the next poll, so we pass it through navigation
state"), and using it is also the smallest possible change: one hook call replaces four statements
and removes a direct API import.

This is not a rule that every command must route through a Collie hook. It is that where Collie has
already solved the timing problem this command has, solving it again would be both more code and
more likely to be wrong.

### Why a Space still has no rename

Worth stating precisely, because "the bridge has none" invites someone to add one. The multiplexer's
own RPC surface DOES expose renaming a workspace. What is missing is the chain between that and the
browser: the capability is not declared, the multiplexer port carries no such verb, no route serves
it, and no client function calls it. Adding it means changing Collie's multiplexer contract, which
obliges every adapter to answer — including the two this fork does not run. That is a decision for
Collie, not a presentation choice for a keyboard.

The same reasoning, one layer lower, is why there is no "new Pane in this Tab": the multiplexer has
no split or pane-create RPC at all, so the gap starts below Collie entirely.

## Risks / Trade-offs

- **Two surfaces can now rename, and could drift** → they call one client function and keep one
  meaning per target; the tests assert the blank-value rule on both paths.
- **A rename input that outlives its target would rename the wrong thing** → it closes on route or
  target change, and submits the id it opened with rather than re-reading the current one.

## Migration Plan

None. Both are corrections to behavior introduced in the same unreleased version.
