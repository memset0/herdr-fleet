## Context

See proposal.md — Why. The folded bar is one full-width `<button>` whose accessible name is a single
exact sentence built from two counts; the expanded tab row already takes one node at its trailing
end.

## Goals / Non-Goals

**Goals:**

- One place says the state at any moment, and the operator never has to find which.

**Non-Goals:**

- Changing when the fold happens or how the bar is expanded.

## Decisions

### The bar's trailing node rides BESIDE the button, not inside it

Put inside, the state's word joins the button's accessible name — "Show tabs and panes. 3 tabs, 2
panes hidden. needs you" is not a sentence about what the control does. So the bar is wrapped and the
node is positioned over its own row with `pointer-events-none`, which keeps the whole bar one 44px
target and leaves its name exactly as Collie wrote it.

### The manual fold goes, and its label keys go with it

With the control removed nothing reads the three `chat.strips.hide.*` messages, but they stay in the
dictionaries: they are Collie's own, and a fork that deleted upstream strings would be a merge
conflict every sync for no gain.

### The composer's band is gated on the strips EXISTING, not on their being open

Previously it came back whenever the strips were folded, which is the moment the screen has least
room. Now the folded bar says it, so the band's condition is the honest one: is there any strip
surface at all.

## Risks / Trade-offs

- [The operator can no longer fold the strips deliberately] → The automatic rule already covers the
  case that motivated the control — typing — and the device-level preference behind it is untouched,
  so a future change can re-expose it without a migration.
