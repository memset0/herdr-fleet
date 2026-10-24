## Why

The Pane's terminal surface often shows "ended", and Reconnect often does not help: for a while after
a held session is reclaimed, every new session's `terminal attach` exits within milliseconds of
opening, the Gateway logs only `upstream-exit`, and the surface says "ended" again. The operator
cannot see why, has to keep pressing Reconnect, and a terminal they stepped away from for half a
minute is already reclaimed. The owner asked for three things: the failure made visible, an ended
Pane that is easy to re-open, and a reclaim delay of about an hour for terminals nobody is watching.

## What Changes

Baseline: Collie v1.23.3 as recorded in `UPSTREAM.md`; Herdr Fleet 3.24.2.

- **Longer grace, more held sessions.** The lead holds an unwatched session for one hour (was twenty
  seconds; the validated upper bound rises to six hours) and holds up to eight sessions (was four),
  which is no more than a member's own default server maximum. When the bound is reached, a session
  with no browser attached is evicted first, least recently used; a watched session is evicted only
  when every held session is watched.
- **Early-exit diagnostic.** A session that ends with `upstream-exit` within five seconds of being
  opened is an *early exit*. Its `terminal.session-ended` line gains `early`, its lifetime in
  milliseconds, and `tail`: the last ≤300 printable characters of what the session printed, with
  every control and escape sequence removed. The same tail is sent to the browser in one new
  Gateway→browser frame immediately before the existing `ended` notice, and the surface shows it.
  Output of a session that lived past the window is never captured, logged or sent this way.
- **Automatic retry of an early exit.** The surface retries an early exit by itself with backoff
  (1, 2, 4, 8, 15, then every 30 seconds, for up to three minutes), showing "reconnecting" and the
  tail rather than "ended". Reconnect still works at any time and restarts the backoff. When the
  budget is spent the surface says the terminal keeps exiting as it starts and offers Reconnect.
- **Returning re-opens an ended terminal.** Coming back to a Pane whose terminal ended — navigating
  back to it, or the page becoming visible again while it shows "ended" — opens one fresh connection
  instead of leaving the stale ended screen. The surface's closed state is now owned by the retained
  terminal, so a retained terminal that ends while shown by a later visit is reported to that visit.
- The notice vocabulary (`unavailable`, `busy`, `ended`, `taken`, `protocol`) and its meanings are
  unchanged; Take over is unchanged and is never automatic; neither the retry nor a return ever
  carries take-over intent. New strings are Fleet's own, in all seven Fleet locales.

Non-goals: finding and fixing the underlying cause of the early exits (this change makes it
visible); any change to the member's terminal service, its grammar, its limits, or its terminal
server invocation; capturing the terminal server's own stderr; a Gateway-side retry; any change to
Collie-owned files.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-pane-terminal`: held-session grace and capacity, early-exit diagnostics and their one
  exception to the content-free diagnostics rule, automatic retry of an early exit, and reconnect on
  return.

## Impact

Fork-owned only: `fleet/terminal/{service,session,connection,browser}.ts`, a new pure
`fleet/terminal/early-exit.ts`, `fleet/ui/terminal/link.ts`, a new pure `fleet/ui/terminal/recover.ts`,
`web/src/components/fleet-terminal.tsx`, the seven Fleet locale files, their tests, the log
comment in `fleet/gateway-main.ts`, and the Fleet manual (`fleet/README.md`). Every new file falls
under an existing owned root in `FORK.toml`; its verify lists name the two new test files. The Gateway and the browser bundle are the
lead's; the member's terminal service and the crew wire are untouched, so this is a PATCH.
