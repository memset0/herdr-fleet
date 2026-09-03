## Context

See proposal.md — Why. Collie's `PaneActionsSheet` and `TabActionsSheet` already own the writes, the
capability gates, the rename mode and the read-only refusal, and both take the row object plus four
callbacks. The hierarchy's rows are derived data with no such object in them.

## Goals / Non-Goals

**Goals:**

- Reach the existing sheets; define no second write and no second menu.

**Non-Goals:**

- Actions for a Space or a Host. The bridge has `createWorkspace` and nothing that renames or closes
  one, so the tree offers neither.

## Decisions

### The model says what a row's actions would ACT ON, and nothing else

A row gains a `subject` — the Pane it stands for, or the Tab it groups — separate from the `target`
that says what activating it opens. The two answer different questions: a Space row activates and has
nothing here to rename, a Tab group row renames and activates nothing. A row with no subject offers
no actions at all, which is how the Space and the Host say "not here" without a special case.

The subject is an ID, not a row object: the shell resolves it against the current snapshot at render,
so a sheet always acts on what the snapshot says now rather than on a copy taken when the menu opened.

### The gesture sits on the row, not on one of its controls

`useLongPress` is Collie's own hook and already handles both halves — a pointer's `contextmenu` and a
touch's timed press — plus the capture-phase guard that stops the ensuing click from activating the
row. Spread on the row's box it covers the chevron and the label alike, which is what "right-click
the row" means.

### The shell mounts the sheets, because the shell holds the snapshot

The tree renders rows; it has no `AgentView`, no scope and no revalidator. The shell has all three,
so it maps the subject to Collie's own row object and mounts the two sheets beside the overlay.

## Risks / Trade-offs

- [A long press on a hierarchy row now does something it did not] → It is the same gesture the Pane
  pill and the Tab pill already answer, so the tree stops being the exception.
- [Closing a Pane from the tree can navigate] → Only when it is the Pane on screen, which is the rule
  the Pane strip already follows for the same act.
