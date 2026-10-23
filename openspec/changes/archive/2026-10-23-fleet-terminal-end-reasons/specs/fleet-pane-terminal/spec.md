## MODIFIED Requirements

### Requirement: Terminal diagnostics carry no terminal content and no authentication material
Diagnostics for this capability SHALL be limited to lifecycle transitions, Pane and Host identity,
bounded timestamps, session and pool counts, component health, and non-secret failure reasons.

They MUST NOT contain terminal input, terminal output, retained output windows, session cookies or
tokens, signing material, credentials, injected identity headers, environment dumps, or Pane history.
A failure SHALL be reported by the layer that failed and its non-secret reason, so a closed terminal
can be diagnosed without reading what was on it.

Every Gateway diagnostic line SHALL carry the time it was written as an ISO-8601 timestamp.

Every end of a terminal session SHALL be reported exactly once, by the layer that decided it, with the
Pane and Host identity, whether a browser was attached, and one reason from a closed vocabulary:
`restart` (the Gateway shut down), `upstream-exit` (the terminal attachment or its server went away),
`start-failed` (establishment failed after the server started), `grace-expired`, or `evicted`. An
`upstream-exit` SHALL carry the upstream transport's numeric close code when one is known, and
nothing the terminal printed.

Every browser connection the Gateway ends for a reason above the session SHALL be reported exactly
once with the Pane and Host identity and one reason from a closed vocabulary: `auth-ended` (logout or
explicit revocation), `auth-expired` (the admitting session stopped being current), or `restart`. A
connection ended because its session ended SHALL NOT be reported a second time. No reason SHALL be
added to what the browser is told.

#### Scenario: A terminal session is established and closed
- **WHEN** diagnostics are reviewed after a session's full lifecycle
- **THEN** they show the transitions, identity, timing and health needed to verify closure, and contain no terminal content or authentication value

#### Scenario: A connection fails
- **WHEN** authentication, Pane resolution, terminal startup, or transport fails
- **THEN** the failing layer and a non-secret reason are reported, without terminal content or credential material

#### Scenario: The upstream attachment exits under a browser
- **WHEN** the terminal attachment exits while a browser is attached
- **THEN** one timestamped line names the Pane, reason `upstream-exit`, that a browser was attached, and the close code when known, and the browser is told only that the terminal ended

#### Scenario: An operator's session is revoked
- **WHEN** a logout, revocation or expiry sweep ends a browser's terminal connection
- **THEN** one timestamped line names the Pane and reason `auth-ended` or `auth-expired`, and the session it was attached to is held, not closed

#### Scenario: The Gateway restarts
- **WHEN** the Gateway shuts down with browsers attached and sessions held
- **THEN** each open connection and each held session is reported once with reason `restart`

## ADDED Requirements

### Requirement: A closed terminal connection can be reconnected in place
When the terminal surface's connection closes for any reason, the surface SHALL show that it closed
and SHALL offer a keyboard-accessible Reconnect control, labelled in the operator's language, that
establishes a fresh connection for the same Pane and scope without leaving the route. Reconnecting
SHALL go through the ordinary admission and establishment path and MUST NOT change browser
exclusivity: a held session with another browser attached SHALL still refuse the new connection
without displacing the first. The surface SHALL NOT reconnect on its own.

#### Scenario: The terminal ended while the operator watched
- **WHEN** the connection closes while the Pane's terminal surface is shown
- **THEN** a notice with a Reconnect control appears, and activating it opens one new connection for the same Pane and hides the notice

#### Scenario: Another browser holds the terminal
- **WHEN** the operator reconnects while another browser is attached to the session
- **THEN** the new connection is refused as busy and the other browser is unaffected
