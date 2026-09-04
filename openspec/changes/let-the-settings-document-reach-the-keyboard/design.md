## Context

See `proposal.md` — Why. The provider already accepts `overrides` and `prefix`; nothing supplies
them. Everything else on the path exists and works.

## Goals / Non-Goals

Goals beyond the proposal:

- Close the gap with the smallest wiring that can be tested end to end, and add the test that would
  have caught it.

Non-goals:

- Any caching, revalidation or polling story. The document changes when a person changes it.

## Decisions

### Loaded once, at the shell, and re-read on save

The navigation shell is where the command provider is mounted and is on screen for the life of the
application, so it is where the document is read. One fetch on mount; one more when the Settings page
reports a save, through the same store the settings section already writes.

Not a loader on a route: the keyboard has to work on every route, including the ones that do not draw
Settings, and a route loader would tie the operator's bindings to having visited a page.

Not polled. A document is a person's decision, not a data feed, and a poll would spend a request
every few seconds to notice something that changes twice a year.

### Absent is a first-class answer, and so is broken

The route answers 404 on an installation with no Fleet Gateway in front of it — Collie's own tests
and its playground included — and the loader treats that as "shipped defaults", not as an error. A
document that fails to parse is already held by the Gateway, which serves the last good one; a fetch
that fails for any other reason falls back the same way. There is no state in which the operator ends
up with a keyboard that does nothing.

### The test that was missing

The existing tests hand `overrides` to the provider. That is worth keeping — it is how the matching
rules are tested — but it cannot fail when the wiring is absent, which is exactly what happened.

The new test serves a document over the fake network and then presses a key, so the assertion is
about the operator's experience rather than about a prop. One test of that shape is worth more here
than several more of the other.

## Risks / Trade-offs

- **The document arrives after the first render, so a key pressed in that window uses the defaults** →
  the window is one fetch on a loopback route, and the failure mode is that an early keystroke runs a
  shipped binding rather than an operator's. Blocking the whole application on it would be a worse
  trade.

## Migration Plan

None. An installation with no document sees no change; one with a document starts getting what it
already said it wanted.
