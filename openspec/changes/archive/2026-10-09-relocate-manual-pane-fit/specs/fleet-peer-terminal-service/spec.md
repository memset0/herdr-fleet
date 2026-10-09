## MODIFIED Requirements

### Requirement: The peer terminal service answers one fixed contract and nothing else
The peer terminal service SHALL expose exactly one control contract of four operations: request a
Pane's terminal, close a Pane's terminal, fit a Pane to a column count, and report its own state. Every
request SHALL be validated against an explicit message grammar and SHALL be refused when it carries an
unknown field, an unknown operation, or a value outside its declared bounds. A fit request SHALL carry
exactly a Pane id and an integer column count from 20 through 500.

The service MUST NOT accept a command, command argument, executable path, socket path, environment
value, account, multiplexer server selector, row count, or file path from a request. Every such value
SHALL come from the peer's own validated configuration and its own local multiplexer server.

The service SHALL be reachable only over the peer's own loopback projection of its terminal endpoint,
SHALL refuse a request that arrives from anywhere else, and MUST NOT expose a publicly reachable
listener. The requested terminal SHALL be served over that same endpoint, and the stream SHALL be a
byte-for-byte forward of the terminal server's own wire: this service SHALL NOT interpose a protocol
of its own on it, so nothing about that wire has to be agreed twice.

#### Scenario: A valid request is made
- **WHEN** the service receives a well-formed request for one of the four declared operations
- **THEN** it performs exactly that operation and reports its outcome

#### Scenario: A request carries an unknown field or operation
- **WHEN** a request carries an unknown operation, an unknown field, or an out-of-range value
- **THEN** it is refused with a qualified diagnostic rather than partially applied

#### Scenario: A request carries execution detail
- **WHEN** a request carries a command, argument, executable, socket path, environment value, account, server selector, or row count
- **THEN** it is refused, and no such value from a request is ever used

#### Scenario: A request arrives from outside the projection
- **WHEN** a connection reaches the service other than through its declared loopback endpoint
- **THEN** it is refused before any Pane is resolved or any terminal is started

### Requirement: An unused device stands its terminal service down
The peer terminal service SHALL stand itself down after a bounded idle interval during which it holds
no terminal server, holds no retained resize controller, and has received no request. The interval SHALL
be configurable with an explicit default of one hour, and SHALL be validated against declared bounds.

Standing down SHALL be an ordinary successful end of the service, not a failure, and the peer's
supervisor SHALL report it as idle and make the service available again for the next request. It
SHALL leave the peer in the process set it had before any terminal was requested, and SHALL remove
the service's own endpoint and ephemeral state. It MUST NOT stop the multiplexer server,
Collie, or the link, and MUST NOT require an operator to restart anything for the next request to
succeed: a later request SHALL bring the service back with no residual state from the previous one.

#### Scenario: A device is unused
- **WHEN** the service has held no terminal server and no resize controller, and received no request for its configured idle interval
- **THEN** it stands down, removes its endpoint and ephemeral state, and leaves Collie, the multiplexer server, and the link running

#### Scenario: A request arrives after standing down
- **WHEN** a terminal is requested for a peer whose service has stood down
- **THEN** the service is available again and serves the request, carrying no state from before it stood down

#### Scenario: The service is not idle
- **WHEN** the service holds at least one terminal server or resize controller, or has been asked for something within the interval
- **THEN** it does not stand down

## ADDED Requirements

### Requirement: A peer fits its own Pane on request
On a validated fit request the peer SHALL resolve the Pane and its current viewport rows against its
own local multiplexer server and resize it through its own retained, no-takeover controller, following
the manual Pane fit requirements for rows and controller ownership. It SHALL answer the applied columns
and rows, or a closed failure reason, and SHALL release every retained controller when the service
stops.

#### Scenario: A member's Pane is fitted
- **WHEN** the lead asks the peer to fit one of its Panes to a valid column count
- **THEN** the peer resizes that Pane keeping its own row count and answers the applied dimensions

#### Scenario: The Pane does not exist on the peer
- **WHEN** the requested Pane id matches no live Pane, or more than one
- **THEN** the peer refuses without resizing any other Pane

#### Scenario: The service stops while holding a controller
- **WHEN** the peer terminal service stops
- **THEN** every resize controller it retained is released and every Pane keeps running
