## Context

The terminal surface's chain is: browser surface (`web/src/components/fleet-terminal.tsx`, its
retained-instance pool and `fleet/ui/terminal/link.ts`) → Gateway connection
(`fleet/terminal/connection.ts`) → session set (`fleet/terminal/session.ts`) → a terminal server, local
or on a member through its own terminal service, running `terminal attach <id> --takeover`.

Observed in production: for one to six minutes after a member Pane's previous session ended with
`grace-expired` or `evicted`, every new session ends `upstream-exit` (close code 1000, browser
attached) within a millisecond of `terminal.session-opened`. The member really starts a fresh terminal
server each time and nothing stale remains; the attach child exits at once. Its own error goes to its
pty, so it reaches the Gateway as terminal output just before the close and is then thrown away, and
the terminal server's stderr is discarded. A manual probe showed the attach exits 1 with a "zero-sized
grid" error when its pty is 0×0, and holds with a real size; a plain kill-and-reattach did not
reproduce the storm. The root cause is therefore still unknown, and this change is built to make it
visible and survivable, not to guess it.

The lead's numbers were a 20 s grace period (bound 600 s) and four sessions; a member's terminal
service defaults to a one-hour idle stand-down and eight servers.

## Goals / Non-Goals

**Goals:** an unwatched terminal survives an hour; an early exit says what it printed, in the log and
on screen; an early exit recovers by itself; an ended terminal re-opens when the operator comes back
to it. Lead-only, so a PATCH.

**Non-Goals:** fixing the root cause; any member-side change (terminal service, its grammar, limits,
server invocation or stderr); a Gateway-side retry; new notice words; changes to Take over.

## Decisions

### Grace one hour, bound six hours, eight sessions, eviction prefers the unwatched

`FLEET_TERMINAL_LIMITS` becomes `graceMs: 3_600_000`, `maxSessions: 8`; the graceMs upper bound
becomes `21_600_000`. Eight equals the member's default `max_servers`, so even if every held session
were on one member the lead would not exceed what that member admits by default (a member configured
lower still refuses with its own `at-capacity`, as today).

The old doc comment argued twenty seconds from the cost of holding the Pane's geometry. That cost is
real and unchanged: a held session keeps the Pane at the last browser's size while nobody watches it,
for up to an hour. The owner chose that trade-off, and the comment now says so honestly rather than
arguing the old number.

Eviction: the existing loop picked the LRU established session with no in-flight acquirer, whether
or not a browser was attached. It now picks the LRU such session with no browser first, and falls back
to the LRU attached one only when every candidate is attached. Strictly refusing to evict a watched
session would let eight open tabs block a ninth Pane forever (the reserve loop waits for a change that
never comes), so the fallback keeps the old guarantee that a new request always progresses.

### Early exit: five-second window, measured from the session object's creation

`fleet/terminal/early-exit.ts` (pure) owns `EARLY_EXIT_WINDOW_MS = 5_000`, the byte bound
(`EARLY_TAIL_BYTES = 4_096`), the character bound (`EARLY_TAIL_CHARS = 300`), the sanitizer, and a
small `EarlyTail` capture. A `Session` creates one at construction (after the server started, before
the upstream connects, so output that arrives during connect is caught) and pushes every output chunk
into it; the first push after the window drops the buffer for good and every later push is a no-op.
On `close("upstream-exit")` inside the window the session logs `early: 1`, `ms` and `tail` (only when
non-empty) and hands the tail to the attached client.

Five seconds: the observed failure is ≤1 ms, establishment is measured in hundreds of milliseconds,
and a human cannot meaningfully type into a terminal and have it exit within five seconds of it
appearing except by accident — so a real session that is ended by its user is not mislabelled, and a
slow failing start (e.g. a member under load) is still caught.

**Sanitizer.** A small scanner rather than one regex, because terminal output arrives in arbitrary
chunks and may end inside a sequence. It decodes UTF-8 leniently, then drops: CSI (`ESC [` … final
byte), OSC (`ESC ]` … BEL or ST), DCS/SOS/PM/APC (`ESC P/X/^/_` … ST), two- and three-byte escapes,
a trailing incomplete sequence, C1 controls, and every C0 control and DEL; CR, LF and TAB become
spaces; whitespace runs collapse and the ends are trimmed; the last 300 code points are kept with a
leading `…` when cut. The result is plain text the browser renders as a React text node.

**Why the diagnostics exception is acceptable.** The no-content rule exists so ordinary terminal
content never lands in logs. A session that died inside five seconds produced, in practice, its own
attach error and at most the multiplexer's opening repaint; the tail is bounded, sanitized, and is the
only way to see the failure, since the child's stderr is its pty. Any session outliving the window has
its buffer discarded before anything is logged.

**ttyd's stderr was considered and declined.** It would give the child's exit code, but the failures
seen are on members, whose terminal server the member's own service starts — capturing it there is a
member update. For local Panes it would mean piping and continuously draining a long-lived process's
stderr for a diagnostic the pty tail already gives. Not cheap enough for what it adds.

### Carrying the tail to the browser: one new Gateway→browser frame

`browser.ts` gains `TO_BROWSER.exit` (`"x"`) and `exitFrame(tail)`. The connection sends it just
before the `ended` notice when the session's close carried an early exit (`AttachedClient.close`
takes an optional `{ tail }`). The notice word stays `ended`, so the closed vocabulary is unchanged and
an older bundle that ignores unknown frames still sees "ended". The browser→Gateway grammar is
untouched. An early exit that happens before a browser attached (not observed: the Gateway attaches
synchronously once establishment resolves, and the logs show `browser: 1`) answers `unavailable` as
before and is not retried.

### Where the retry lives: the browser surface

Chosen over a Gateway-side retry, for these reasons:

- **The browser already has the whole loop.** Reconnect is an attempt bump that builds a fresh link
  through ordinary admission. A retry is that same act on a timer; manual Reconnect cancelling and
  restarting the backoff falls out of the same state.
- **Nobody watching means no retries.** The timer belongs to the mounted surface; leaving the Pane
  cancels it. A Gateway retry would keep re-spawning terminal servers on a member for a socket whose
  browser may have gone to sleep, and would need its own cancellation story for that.
- **Admission is re-checked every attempt.** A revoked or expired cookie stops retries naturally. A
  Gateway loop would retry under a session admitted minutes ago and need to re-check it itself.
- **No new connection states or notices.** A Gateway retry needs a socket that stays open with no
  terminal behind it, a non-closing "reconnecting" notice (a new word), and a second attach repaint
  landing over the first on the same emulator. The browser path adds one pure module and one timer.

Cost: each attempt is one more upgrade and resolve; the schedule bounds it to about ten in three
minutes.

**Schedule.** `fleet/ui/terminal/recover.ts` (pure): delays 1, 2, 4, 8, 15, then 30 s repeating; a run
starts at its first early exit; `next(now)` returns the next delay, or `null` when `now - start +
delay` would exceed 180 s (so 1+2+4+8+15+30+30+30+30+30 = 180 s: ten automatic attempts). A run ends
(`reset`) on manual Reconnect, on a non-early close, and when a connection has stayed open for the
early window plus one second after its first output — that last one is what tells "it recovered"
apart from "it is about to fail again", since a failing attempt opens and prints too. Timed from the
first output rather than the socket's open because output only flows once the browser is attached,
which is after the Gateway's session began: a genuine early exit therefore always closes before this
timer fires, however slow establishment was. The reconnecting notice stays up until then.

**UI.** While a run is active the closed notice says it is reconnecting and shows the tail in a small
monospace line; Reconnect stays. When the budget is spent it says the terminal keeps exiting as it
starts, with the tail and Reconnect. Three new Fleet keys, all seven locales.

### Returning re-opens

Navigating back already rebuilt an ended retained instance (the pool hands back an entry marked
`ended` and the surface replaces it), and is kept and now specified. Added: on `visibilitychange` to
visible, a surface whose closed notice is `ended` (or no word) and has no automatic attempt pending
reconnects once, starting a new run. `busy`, `taken`, `unavailable` and `protocol` are left for the
operator, so a page coming back never steals or loops on a held terminal.

**Closed state moves onto the retained entry.** The link's handlers used to call the creating mount's
`setState`. `AgentChat` is keyed by Pane, so a later visit to the same Pane is a new mount that takes
the still-open entry back from the pool — and when that connection later closed, it told the old,
unmounted component, leaving the visible surface frozen with no notice. The entry now records its
notice and early tail and calls a `closedHook` the current mount installs (as it already does for
`opened`/`answered`), so whichever visit is on screen hears the close.

## Risks / Trade-offs

- **An hour of held geometry.** A Pane left in Fleet keeps the browser's size on its own machine for
  up to an hour after the browser leaves. Accepted by the owner. The numbers are code constants
  validated against their bounds, not operator configuration; the six-hour ceiling only bounds a
  future retune.
- **More held servers.** Up to eight terminal servers on the lead and members instead of four;
  each is a small process. The member's own maximum still applies.
- **A tail could contain something sensitive** if a session prints a secret and exits within five
  seconds. Bounded to 300 characters, only on that path, and the alternative is no diagnosis at all.
- **Retries could hide a persistent failure for three minutes.** The tail is shown throughout, so
  the operator sees the cause from the first failure; the budget then stops.
- **Root cause unknown.** The 0×0 probe suggests a geometry race on the member, but nothing here acts
  on that guess; the first real early exit's tail should name it.

## Migration Plan

Lead only: rebuild and restart the lead's Gateway. No member redeploys; no configuration changes.
Rollback is the previous lead commit.

## Open Questions

- What the tail says in production, and whether the cause is then fixable on the lead alone or needs
  a member release (a separate change either way).
