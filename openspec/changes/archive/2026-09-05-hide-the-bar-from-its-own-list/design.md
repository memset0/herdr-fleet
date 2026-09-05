## Context

Command mode is the only mode that lists commands; pane mode lists panes. So there is exactly one
surface for this rule to apply to, and exactly one command it removes today.

## Goals / Non-Goals

**Goals** — no inert row in the palette.

**Non-Goals** — a general "self-referential command" framework. One predicate, named for its reason.
`open-pane-switcher` is deliberately kept: from command mode it is a real transition.

## Decisions

### The filter is on the bar, not in the catalog

The catalog is what commands exist; the bar decides what is worth showing HERE. Removing the id from
the catalog would unbind it, and hiding it in `commandRows` would hide it from the settings reference
too — the two places an operator needs it most. So the omission lives at the one call site whose
question is "what can I do from this surface".

### It reads as a rule, not as an id

`open-command-bar` is the only command this catches today, and the code says why it is caught rather
than listing it — so a second self-opening command added later is caught by the same sentence instead
of being the second special case somebody has to notice.

## Risks / Trade-offs

- **An operator looking for the row will not find it.** That is the point, and the settings reference
  still lists it with its bindings, which is where you go to change them.

## Migration Plan

None. Display only.

## Open Questions

None.
