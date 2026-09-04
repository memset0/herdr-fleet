## Why

A Space row offered nothing, on the rule that a row must never offer what cannot land. That rule was
right and the conclusion was only half right: the bridge cannot rename a Space, but it can open a Tab
in one — `createTab` is a declared multiplexer capability with a route, a client call and Collie's
own `useSpaceActions().newTab` behind it, which is exactly what the tab strip's + button uses.

So the Space row was silent about a verb it could have offered, and the operator's only way to open a
tab was to be inside a pane of that space already.

## What Changes

- A Space row offers its own actions, with one verb: open a Tab in this Space. The act is Collie's —
  the same call, read-only gate, refusal copy, revalidation and navigation into the new pane.
- It is offered through the same pair of surfaces every other row uses: a menu at the cursor, the
  bottom sheet for a thumb.

Non-goals:

- Renaming a Space. Herdr has `workspace.rename`, but nothing between the tree and it does — no
  multiplexer capability, no adapter verb, no bridge route, no client call — so offering it would be
  offering something that cannot land. Adding it is a change to Collie's own multiplexer contract
  across three adapters, and belongs to its own decision.
- Opening a Pane inside an existing Tab. There is no such verb at any layer, Herdr's own contract
  included.
- Any change to what a Host row offers, which stays nothing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the row-actions requirement states what a Space row offers and
  what it deliberately does not.

## Impact

- One subject in the fork-owned navigation model, one fork-owned surface, and its mount in the shell.
- No dependency, route, loader, API call, mutation, backend state, or configuration change: the
  create it performs is Collie's existing one.
