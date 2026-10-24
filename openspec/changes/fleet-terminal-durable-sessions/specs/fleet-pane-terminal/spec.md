## ADDED Requirements

### Requirement: An unwatched terminal session is held for an hour
The lead Gateway's default grace period SHALL be one hour, and its validated upper bound SHALL be six
hours. The lead's default maximum number of held sessions SHALL be eight, which MUST NOT exceed a
member terminal service's own default server maximum, so the lead never asks a member for more
terminal servers than that member allows by default.

When a new session is required at the maximum, the Gateway SHALL evict the least recently used
established session that has no browser attached. Only when every established session that is not
being acquired has a browser attached SHALL it evict the least recently used of those instead. A
held session keeps the Pane's terminal at the geometry its last browser stated until it is reclaimed;
that is the accepted cost of the longer grace period.

#### Scenario: The operator returns within the hour
- **WHEN** the operator leaves a Pane's terminal and returns to it fifty minutes later, and the session was not evicted
- **THEN** the held session is reused and no attachment is re-established

#### Scenario: Nobody returns for an hour
- **WHEN** a session has had no browser attached for its whole one-hour grace period
- **THEN** it is closed with reason `grace-expired`, together with its terminal server and attachment

#### Scenario: Capacity is reached with an unwatched session available
- **WHEN** a new session is required at the maximum, and both watched and unwatched sessions are held
- **THEN** the least recently used unwatched session is evicted, and every watched session is kept

#### Scenario: A grace period outside the bounds is configured
- **WHEN** the Gateway is constructed with a grace period above six hours or below its minimum
- **THEN** construction is refused rather than the value being clamped

### Requirement: A terminal that exits as it starts says what it printed
A session that ends with reason `upstream-exit` within five seconds of being opened SHALL be treated
as an early exit. For an early exit only, the Gateway SHALL derive a tail from the output that session
produced: decoded as text, with every control character and escape sequence removed and whitespace
runs collapsed, and limited to its last three hundred characters. The tail SHALL be added to that
session's one `terminal.session-ended` diagnostic together with an early-exit marker and the
session's lifetime in milliseconds, and SHALL be delivered to the attached browser in one dedicated
frame immediately before the existing `ended` notice.

Output SHALL be retained for this purpose only while a session is inside its early window and only
within a small fixed byte bound; once the window has passed, the retained bytes SHALL be discarded and
nothing a longer-lived session printed SHALL reach a diagnostic or that frame. The notice word itself
SHALL remain `ended`; no new notice word is added.

#### Scenario: The attachment exits immediately with an error
- **WHEN** a session's attachment prints an error and exits one millisecond after the session opened, with a browser attached
- **THEN** the diagnostic line carries reason `upstream-exit`, the close code, the early-exit marker, the lifetime, and the printable tail of the error, and the browser receives the tail followed by the `ended` notice

#### Scenario: The output carries escape sequences
- **WHEN** an early exit's output contains colour, cursor-movement, title-setting or other control sequences
- **THEN** the tail contains only the printable text between them

#### Scenario: A long-lived session exits
- **WHEN** a session that has been open for longer than five seconds ends with `upstream-exit`
- **THEN** its diagnostic carries no tail and no early-exit marker, the browser receives only the `ended` notice, and none of its output was retained for this purpose

### Requirement: An early exit is retried automatically while the surface is shown
When the surface's connection closes after an early-exit frame, the surface SHALL NOT present the
terminal as ended. It SHALL show that it is reconnecting, with the delivered tail as plain text, and
SHALL open a fresh connection for the same Pane by itself after a backoff delay of one, two, four,
eight and fifteen seconds and then every thirty seconds, for as long as the next attempt would start
within three minutes of the first early exit in the run. A connection that stays open past the early
window, or a close that is not an early exit, SHALL end the run. When the run's budget is spent, the
surface SHALL say that the terminal keeps exiting as it starts, show the last tail, and offer
Reconnect.

The operator's Reconnect SHALL remain available throughout; activating it SHALL cancel any pending
automatic attempt, open one connection immediately, and start a new run. Leaving the Pane SHALL cancel
a pending attempt. Automatic attempts SHALL go through the ordinary admission and establishment path
and SHALL NEVER carry take-over intent. Closes with the `busy`, `taken`, `unavailable` or `protocol`
notice SHALL NOT be retried automatically.

#### Scenario: The terminal exits as it starts and then recovers
- **WHEN** two consecutive connections end in early exits and the third holds
- **THEN** the surface shows reconnecting with the tail after each, opens the second connection one second after the first early exit and the third two seconds after the second, and shows the live terminal once the third connection has been open for the early window

#### Scenario: The operator presses Reconnect during the backoff
- **WHEN** an automatic attempt is pending and the operator activates Reconnect
- **THEN** the pending attempt is cancelled, one connection opens immediately, and a further early exit is retried after one second

#### Scenario: The terminal keeps exiting
- **WHEN** early exits continue until the next attempt would start more than three minutes after the first
- **THEN** no further automatic attempt is made, and the surface says the terminal keeps exiting as it starts, shows the tail, and offers Reconnect

#### Scenario: Another browser holds the terminal
- **WHEN** a connection closes with the `busy` notice
- **THEN** no automatic attempt is made, and Take over is offered exactly as before

### Requirement: Returning to an ended terminal re-opens it
When the operator returns to a Pane whose retained terminal connection has closed — by navigating back
to the Pane, or by the page becoming visible again while the surface shows that the terminal ended —
the surface SHALL open one fresh connection for that Pane rather than keep showing the stale closed
state. Such a connection SHALL go through the ordinary admission path and SHALL NOT carry take-over
intent, so a terminal another browser holds still answers `busy`. A page becoming visible again SHALL
NOT reconnect a surface whose closed notice is `busy`, `taken`, `unavailable` or `protocol`.

A retained terminal that closes while it is shown SHALL be reported to the visit that is showing it,
including a later visit than the one that opened its connection.

#### Scenario: The operator navigates back to an ended terminal
- **WHEN** a Pane's retained terminal connection closed while the operator was elsewhere, and the operator navigates back to the Pane
- **THEN** one fresh connection is opened and no ended notice is left on screen

#### Scenario: The page becomes visible on an ended terminal
- **WHEN** the surface shows that the terminal ended and the page is hidden and then shown again
- **THEN** one fresh connection is opened for the same Pane

#### Scenario: A terminal shown by a later visit ends
- **WHEN** the operator leaves a Pane and returns while its connection stays open, and that connection then closes
- **THEN** the surface on screen shows the closed notice and offers Reconnect

## MODIFIED Requirements

### Requirement: Terminal diagnostics carry no terminal content and no authentication material
Diagnostics for this capability SHALL be limited to lifecycle transitions, Pane and Host identity,
bounded timestamps, session and pool counts, component health, and non-secret failure reasons.

They MUST NOT contain terminal input, terminal output, retained output windows, session cookies or
tokens, signing material, credentials, injected identity headers, environment dumps, or Pane history.
A failure SHALL be reported by the layer that failed and its non-secret reason, so a closed terminal
can be diagnosed without reading what was on it. The one exception is an early exit's bounded,
sanitized tail, which the early-exit requirement defines; it is never derived from a session that
outlived its early window.

Every Gateway diagnostic line SHALL carry the time it was written as an ISO-8601 timestamp.

Every end of a terminal session SHALL be reported exactly once, by the layer that decided it, with the
Pane and Host identity, whether a browser was attached, and one reason from a closed vocabulary:
`restart` (the Gateway shut down), `upstream-exit` (the terminal attachment or its server went away),
`start-failed` (establishment failed after the server started), `grace-expired`, or `evicted`. An
`upstream-exit` SHALL carry the upstream transport's numeric close code when one is known; an
early-exit `upstream-exit` SHALL additionally carry the early-exit marker, its lifetime and its tail,
and any other `upstream-exit` SHALL carry nothing the terminal printed.

Every browser connection the Gateway ends for a reason above the session SHALL be reported exactly
once with the Pane and Host identity and one reason from a closed vocabulary: `auth-ended` (logout or
explicit revocation), `auth-expired` (the admitting session stopped being current), or `restart`. A
connection ended because its session ended SHALL NOT be reported a second time. No reason SHALL be
added to the browser's notice word.

#### Scenario: A terminal session is established and closed
- **WHEN** diagnostics are reviewed after a session's full lifecycle
- **THEN** they show the transitions, identity, timing and health needed to verify closure, and contain no terminal content or authentication value

#### Scenario: A connection fails
- **WHEN** authentication, Pane resolution, terminal startup, or transport fails
- **THEN** the failing layer and a non-secret reason are reported, without terminal content or credential material

#### Scenario: The upstream attachment exits under a browser
- **WHEN** the terminal attachment exits while a browser is attached, after the session's early window
- **THEN** one timestamped line names the Pane, reason `upstream-exit`, that a browser was attached, and the close code when known, and the browser is told only that the terminal ended

#### Scenario: The upstream attachment exits as it starts
- **WHEN** the terminal attachment exits within the session's early window
- **THEN** the one timestamped line additionally carries the early-exit marker, the lifetime and the sanitized tail, and nothing else the terminal printed

#### Scenario: An operator's session is revoked
- **WHEN** a logout, revocation or expiry sweep ends a browser's terminal connection
- **THEN** one timestamped line names the Pane and reason `auth-ended` or `auth-expired`, and the session it was attached to is held, not closed

#### Scenario: The Gateway restarts
- **WHEN** the Gateway shuts down with browsers attached and sessions held
- **THEN** each open connection and each held session is reported once with reason `restart`

### Requirement: A closed terminal connection can be reconnected in place
When the terminal surface's connection closes for any reason, the surface SHALL show that it closed
and SHALL offer a keyboard-accessible Reconnect control, labelled in the operator's language, that
establishes a fresh connection for the same Pane and scope without leaving the route. Reconnecting
SHALL go through the ordinary admission and establishment path and MUST NOT change browser
exclusivity: a held session with another browser attached SHALL still refuse the new connection
without displacing the first. The surface SHALL reconnect on its own only as the early-exit retry and
the return-to-an-ended-terminal requirements allow, and never with take-over intent.

#### Scenario: The terminal ended while the operator watched
- **WHEN** the connection closes, not as an early exit, while the Pane's terminal surface is shown
- **THEN** a notice with a Reconnect control appears, no connection is opened on its own while the page stays visible, and activating Reconnect opens one new connection for the same Pane and hides the notice

#### Scenario: Another browser holds the terminal
- **WHEN** the operator reconnects while another browser is attached to the session
- **THEN** the new connection is refused as busy and the other browser is unaffected
