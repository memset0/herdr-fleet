## Purpose

Gives a peer the one thing only it can do for a browser terminal — turn one of its own Pane ids into
that Pane's real terminal and serve it — while keeping a device that nobody is using free of every
process the capability would otherwise leave behind.

## ADDED Requirements

### Requirement: A peer resolves its own Pane ids to terminals, and the lead never does
A peer SHALL resolve a Pane id to that Pane's terminal by reading its own local multiplexer server,
and SHALL be the only side that performs that resolution for its own Panes. A lead MUST NOT resolve,
cache, receive, or infer a peer's terminal id, and MUST NOT accept one supplied by a peer as a
selector it may later name.

Resolution SHALL require exactly one live Pane matching the requested id, and SHALL fail when the
Pane is absent, ambiguous, or resolves to no terminal. It MUST NOT fall back to a focused, default,
first, or neighbouring Pane, and MUST NOT start, discover, or select another multiplexer server.

#### Scenario: A peer resolves one of its Panes
- **WHEN** a lead requests the terminal for a Pane id that exists exactly once on that peer
- **THEN** the peer resolves it against its own local multiplexer server and serves that terminal

#### Scenario: The Pane is absent or ambiguous
- **WHEN** the requested Pane id matches no live Pane, more than one, or a Pane with no terminal
- **THEN** the peer refuses and serves no other Pane's terminal in its place

#### Scenario: A lead attempts to name a terminal
- **WHEN** a request from a lead carries a terminal id rather than a Pane id
- **THEN** the peer refuses it rather than using the supplied value

### Requirement: The peer terminal service answers one fixed contract and nothing else
The peer terminal service SHALL expose exactly one control contract: request a Pane's terminal, close
a Pane's terminal, and report its own state. Every request SHALL be validated against an explicit
message grammar and SHALL be refused when it carries an unknown field, an unknown operation, or a
value outside its declared bounds.

The service MUST NOT accept a command, command argument, executable path, socket path, environment
value, account, multiplexer server selector, or file path from a request. Every such value SHALL come
from the peer's own validated configuration and its own local multiplexer server.

The service SHALL be reachable only over the peer's own loopback projection of its terminal endpoint,
SHALL refuse a request that arrives from anywhere else, and MUST NOT expose a publicly reachable
listener. The requested terminal SHALL be served over that same endpoint, and the stream SHALL be a
byte-for-byte forward of the terminal server's own wire: this service SHALL NOT interpose a protocol
of its own on it, so nothing about that wire has to be agreed twice.

#### Scenario: A valid request is made
- **WHEN** the service receives a well-formed request for one of the three declared operations
- **THEN** it performs exactly that operation and reports its outcome

#### Scenario: A request carries an unknown field or operation
- **WHEN** a request carries an unknown operation, an unknown field, or an out-of-range value
- **THEN** it is refused with a qualified diagnostic rather than partially applied

#### Scenario: A request carries execution detail
- **WHEN** a request carries a command, argument, executable, socket path, environment value, account, or server selector
- **THEN** it is refused, and no such value from a request is ever used

#### Scenario: A request arrives from outside the projection
- **WHEN** a connection reaches the service other than through its declared loopback endpoint
- **THEN** it is refused before any Pane is resolved or any terminal is started

### Requirement: A terminal server on a peer serves one terminal, one writer, and starts only on request
A peer SHALL start a terminal server only in response to a validated request for a specific Pane, and
that server SHALL serve exactly the one terminal resolved for that Pane with at most one writable
client. A terminal server MUST NOT be started at installation, configuration, peer startup, link
establishment, enrolment, or as a side effect of any other operation.

A terminal server SHALL bind only an owner-protected local endpoint, SHALL be reachable only through
the peer's declared terminal projection, and MUST NOT accept command arguments supplied by whatever
connects to it. Its executable identity SHALL be verified against the peer's configured expectation
before it is started.

Closing a Pane's terminal, losing the link, replacing the service, or standing the service down SHALL
stop that Pane's terminal server and release its resources without stopping the multiplexer server,
Collie, the link, or any Pane.

#### Scenario: A terminal is requested
- **WHEN** a validated request names a Pane that resolves to one terminal
- **THEN** exactly one terminal server is started for that terminal, admitting one writable client, bound to an owner-protected local endpoint

#### Scenario: The peer starts with no request
- **WHEN** a peer starts, its link comes up, or its configuration is installed or updated
- **THEN** no terminal server, attachment, or terminal endpoint exists

#### Scenario: The executable does not match
- **WHEN** the configured terminal server executable is missing, or does not match the peer's configured expected identity
- **THEN** the request fails before any process is started or endpoint is bound

#### Scenario: A terminal is closed
- **WHEN** a Pane's terminal is closed, the link is lost, or the service is stood down
- **THEN** that terminal's server and attachment stop, and the multiplexer server, Collie, the link, and every Pane continue running

### Requirement: An unused device stands its terminal service down
The peer terminal service SHALL stand itself down after a bounded idle interval during which it holds
no terminal server and has received no request. The interval SHALL be configurable with an explicit
default of one hour, and SHALL be validated against declared bounds.

Standing down SHALL be an ordinary successful end of the service, not a failure, and the peer's
supervisor SHALL report it as idle and make the service available again for the next request. It
SHALL leave the peer in the process set it had before any terminal was requested, and SHALL remove
the service's own endpoint and ephemeral state. It MUST NOT stop the multiplexer server,
Collie, or the link, and MUST NOT require an operator to restart anything for the next request to
succeed: a later request SHALL bring the service back with no residual state from the previous one.

#### Scenario: A device is unused
- **WHEN** the service has held no terminal server and received no request for its configured idle interval
- **THEN** it stands down, removes its endpoint and ephemeral state, and leaves Collie, the multiplexer server, and the link running

#### Scenario: A request arrives after standing down
- **WHEN** a terminal is requested for a peer whose service has stood down
- **THEN** the service is available again and serves the request, carrying no state from before it stood down

#### Scenario: The service is not idle
- **WHEN** the service holds at least one terminal server, or has been asked for something within the interval
- **THEN** it does not stand down

### Requirement: The peer terminal service is not an authority over membership or identity
The peer terminal service SHALL carry terminal traffic and terminal lifecycle only. It MUST NOT read,
derive, assert, store, or forward Pack membership, Pack identity, certificate material, Pack secrets,
browser session cookies, session-signing material, or the operator's account.

Reaching the service SHALL prove only that a connection arrived over the peer's declared terminal
projection, and that fact alone MUST NOT be treated as a membership, identity, or trust assertion.
A terminal request MUST NOT enrol a peer, alter Pack trust state, or change what the peer is
permitted to do.

#### Scenario: A terminal request is served
- **WHEN** the service serves any request
- **THEN** no Pack membership, identity, certificate, secret, browser cookie, or signing material is read, derived, stored, or forwarded

#### Scenario: The projection is reachable
- **WHEN** something reaches the service over the peer's terminal projection
- **THEN** that reachability alone grants no membership, identity, or trust, and enrols nothing
