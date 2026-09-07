## MODIFIED Requirements

### Requirement: A terminal session outlives its browser by a bounded grace period
The Gateway SHALL hold an established terminal session open for a bounded grace period after its
browser disconnects, so that leaving a Pane and returning within that period reuses the session rather
than re-establishing its attachment. The grace period SHALL be configured and validated against
declared bounds, and a session whose grace period expires SHALL be closed together with its terminal
server and its attachment.

Concurrent requests for the same resolved terminal placement SHALL share one complete establishment:
one terminal server and one Gateway connection to it. No caller SHALL receive a usable session before
both are established. A startup or connection failure SHALL fail all callers waiting on that attempt,
release every resource acquired by it, and allow a later request to establish a new session.

The number of sessions a device holds at once SHALL have an explicit configured maximum, including
sessions whose establishment is still in progress. A new session required while at that maximum SHALL
close the least recently used established session before starting another server. A session still
being established or being handed to an acquiring caller SHALL NOT be evicted mid-establishment; when
no established session is eligible, the new request SHALL wait for an existing acquisition transition
and reevaluate the bound rather than exceed it. Requests for distinct placements SHALL be able to
establish independently while capacity is available.

At most one Fleet browser client SHALL be attached to a held session at a time. A second browser
connection SHALL be refused without displacing, observing, or interleaving with the established one,
and MUST NOT start a second terminal server or external attachment. This browser exclusivity is
distinct from taking over an external Herdr attachment when establishing the session.

Each acquiring caller SHALL relinquish only its own interest when it leaves or finishes attaching.
One caller leaving during shared establishment MUST NOT cancel another caller's session. If no
caller attaches, the completed session SHALL enter the same bounded grace period rather than remain
held indefinitely. Reacquisition SHALL prevent an old grace timer from closing the reused session.

Closing a session for any reason MUST NOT disturb the Pane, its terminal, the multiplexer server,
Collie, or any other session. This requirement bounds a cost, not a correctness property: a session
that was closed SHALL be re-established transparently on the next connection while the Gateway
remains running, so no behavior above this layer may depend on a session having survived. Gateway
shutdown SHALL invalidate all pending acquisitions and close every resource they produce, including
late results; no acquisition SHALL recreate a session after shutdown. An older attempt's completion
or cleanup MUST NOT affect a newer session for the same placement.

#### Scenario: An operator returns within the grace period
- **WHEN** the operator leaves a Pane and returns to it within the configured grace period
- **THEN** the held session is reused and the terminal attachment is not re-established

#### Scenario: The grace period expires
- **WHEN** no browser reattaches to a held session before its grace period expires
- **THEN** the session, its terminal server, and its attachment are closed, and the Pane and its terminal are unchanged

#### Scenario: An operator returns after the grace period
- **WHEN** the operator returns to a Pane whose session was already closed
- **THEN** a session is established transparently and the surface behaves exactly as it does on a first visit

#### Scenario: The session maximum is reached
- **WHEN** a new session is required while the device holds its configured maximum and an established session is eligible for eviction
- **THEN** the least recently used eligible session is closed with its terminal server and attachment before the new session is established

#### Scenario: A second writer connects
- **WHEN** a Fleet browser connection is made to a held session that already has a browser client
- **THEN** it is refused, the established client is neither displaced nor exposed, and no additional terminal server or Herdr attachment is started

#### Scenario: Two browsers arrive while a server is starting
- **WHEN** two browser requests address the same resolved placement before its terminal server and Gateway connection finish starting
- **THEN** one establishment serves both requests, neither obtains a usable session early, and only one browser may attach

#### Scenario: The shared attempt fails
- **WHEN** terminal startup or Gateway connection establishment fails while multiple callers await it
- **THEN** all callers fail, every resource from that attempt is released, and a later request can start exactly one new attempt

#### Scenario: One waiting browser leaves
- **WHEN** one browser disconnects during shared establishment and another remains
- **THEN** the remaining browser can attach to the single completed session and the departed browser neither receives output nor closes that session

#### Scenario: Every waiting browser leaves
- **WHEN** every browser disconnects before shared establishment completes
- **THEN** the completed session enters bounded grace with no attached client and is reclaimed if no browser returns

#### Scenario: Capacity is occupied by in-flight requests
- **WHEN** distinct placements concurrently request more sessions than the configured maximum and every occupied slot is still being established or acquired
- **THEN** additional server starts wait for an existing transition, and establishment never exceeds the configured bound

#### Scenario: Shutdown overlaps establishment
- **WHEN** the Gateway shuts down while a terminal server or its connection is still being established
- **THEN** the callers fail, late results are closed, owned cleanup completes before the terminal socket directory is removed, and no session is recreated

#### Scenario: An old callback arrives after replacement
- **WHEN** an earlier session's close callback or failed attempt completes after a replacement exists for the same placement
- **THEN** the replacement remains registered and usable and receives none of the predecessor's resources or retained output

## ADDED Requirements

### Requirement: Establishing a terminal takes over an external Herdr attachment
When the terminal surface establishes the Gateway's attachment to a resolved local terminal, it SHALL
request automatic Herdr attachment takeover. An external process already attached to that terminal
SHALL be displaced without requiring another button, setting, request field, or confirmation. This
policy SHALL NOT permit a second Fleet browser to displace the browser already attached to the same
held session, and SHALL NOT change the manual Pane-fit controller's ownership policy.

All existing admission, trusted Pane resolution, fixed execution arguments, owner-protected endpoint,
single-client terminal-server, input, geometry, and diagnostic boundaries SHALL remain in effect.
Takeover MUST NOT be used to mask duplicate session establishment.

#### Scenario: Another process holds the terminal
- **WHEN** an admitted browser requests the terminal surface for a Pane whose terminal has an external Herdr attachment
- **THEN** Fleet establishes its attachment by taking over that external attachment and serves the requested terminal without additional operator interaction

#### Scenario: A browser already owns the held session
- **WHEN** another browser requests the same held session
- **THEN** Fleet refuses the second browser under the existing single-browser rule rather than invoking takeover again

#### Scenario: Admission fails
- **WHEN** a request fails the existing authentication, Host, Origin, or Pane-resolution boundary
- **THEN** no terminal server starts and no external attachment is displaced
