## Context

Both halves are downstream-only. Collie has no global keyboard layer and no Pane switcher, so nothing
here changes upstream behaviour or reads as a departure from an upstream decision. The baseline is
the Collie release recorded in `UPSTREAM.md`; the surfaces involved — the command bar, the shared
panel, the roster — are already fork-owned under `FORK.toml`.

The constraint that shaped both decisions is the fork boundary: neither half may edit an
upstream-owned file, and both are reachable without doing so.

## Goals / Non-Goals

**Goals**

- A command never costs the operator their place in the draft.
- A Pane is findable by any fact that names it.
- No new invasive path, and no new entry in `FORK.toml`.

**Non-Goals**

- Focus management anywhere but the composer. Fleet does not become a focus manager for Collie's
  other controls.
- Any change to roster ORDER, to what the right rail draws, or to how a Pane is opened.
- Searching a Pane's id, its agent implementation, or its working directory. Those are not names an
  operator holds in mind, and each one widens the result set for a query that meant something else.

## Decisions

### The composer is reached through the attribute it already carries

`ChatInput` renders `data-slot="chat-input"`, a stable attribute upstream already puts on the
composer's textarea for its own tests. Reading it costs the fork nothing: no import, no prop, no new
port, no manifest entry. The alternatives were worse in exactly the way the boundary rule names — a
ref threaded down from the shell would put a Fleet-shaped prop on every component between, and a
context published by the composer would be an upstream file absorbing downstream logic.

The same reasoning covers `[data-slot="fleet-panel"]` in the other direction: the panel is ours, and
querying for it is how the return knows a surface with its own field is standing.

### The return settles over a window rather than firing once

A Pane switch is a route change: the composer of the Pane being switched to does not exist when the
command's action resolves, and neither a fixed delay nor a single frame can know when it will. So the
return polls a short bounded window and acts only when the caret is NOT already in a composer.

That condition is what makes it safe rather than merely eventual. An operator who starts typing
inside the window holds the caret, the condition is false on every remaining tick, and nothing moves
under their hands. It is also what lets the window follow a composer element that React replaces
mid-switch: the new element does not have the caret, so the next tick takes it.

A disabled composer — a gone Pane, a read-only Pane, the idle pause — is waited for rather than
spent an attempt on, because focusing it would do nothing and would end the window.

### Which commands land at the end

The rule is "did the operator end up looking at a different draft", not "did the route change". Tab
selection, Pane stepping, Tab creation and both closes qualify; a resize, a mode flip, a key send and
a clipboard copy do not. A close qualifies because the Pane it closed is not the Pane the app falls
back to.

### The panel restores what it took, and falls back to the composer

The shared panel already restored focus to whatever held it before it opened. Two corrections make
that correct after a shortcut rather than only after a tap: `body` is not recorded as somewhere to
return to — it is what "nowhere" looks like, and it is exactly what a consumed key leaves behind —
and an element that is no longer on screen falls through to the composer. This keeps the caret's
offset for free in the common case, because a browser preserves a textarea's selection across a blur.

### A row shows the fact it matched on, in the slot it already had

Matching four fields creates a new problem: a row can appear for a reason the row does not show. The
answer is the one context slot the row already renders — same element, same width, a different
string. A match on the Tab or the host displays that string, marked; anything else displays the Space
as before. Nothing appears or disappears, so `DESIGN.md` §2 holds.

The field ORDER is part of the contract rather than an internal detail, because the row reads the
matched field's index back. It is named once, beside the entry type, so the search and the row cannot
come to disagree about which index means what.

### `tabLabel` is a fact the bridge already publishes

`AgentView.tabLabel` is denormalised bridge-side and is absent — not empty — when the Tab's name says
nothing, because Herdr numbers an unlabelled tab positionally. Carrying that distinction onto the
roster entry keeps "no Tab name" out of the search rather than turning it into an empty string every
query would have to be defended against.

## Risks / Trade-offs

- **The settling window is a wall-clock budget.** A route change slower than the window leaves the
  caret where it was. The failure is the status quo rather than a new fault, and the window is sized
  for a slow phone with a poll in flight.
- **Four search fields widen the result set.** A short query now matches more rows. The fuzzy scorer
  already ranks boundary and adjacency hits above scattered ones, and the row says which field it
  matched, so a wide result is legible rather than confusing.
- **`data-slot="chat-input"` is upstream's attribute.** If a future Collie renames it, the return
  quietly stops working. It fails soft — the caret simply stays where a command left it, which is
  today's behaviour — and the fork's own tests name the selector, so the break surfaces there.

## Migration Plan

None. No configuration, no persisted state and no wire field changes; the behaviour is live on the
next frontend build.

## Open Questions

None.
