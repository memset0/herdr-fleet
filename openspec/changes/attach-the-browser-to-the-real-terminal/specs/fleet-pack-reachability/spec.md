## MODIFIED Requirements

### Requirement: One Peer-originated link carries both loopback projections
A schema-2 Peer SHALL open exactly one outbound SSH connection to the Lead's operator-configured SSH
endpoint and SHALL carry both reachability directions on that single connection.

The connection SHALL publish exactly two projections, and a third only when the Peer's validated
configuration declares a terminal endpoint, and no others:

- a remote projection binding the configured Lead-side loopback endpoint to the Peer's own validated
  `[collie]` endpoint, so the Lead dials the Peer's native Pack listener at a Lead-local address;
- a local projection binding the configured Peer-side loopback endpoint to the Lead's configured
  Collie loopback endpoint, so the Peer reaches the Lead through the same connection;
- when and only when the Peer's validated configuration declares a terminal endpoint, a remote
  projection binding the configured Lead-side terminal loopback endpoint to the Peer's own validated
  terminal endpoint, so the Lead reaches that Peer's terminal service at a Lead-local address.

The terminal projection SHALL carry terminal traffic only, SHALL be a distinct Lead-side endpoint from
the Pack projection's, and MUST NOT be reused to reach the Peer's Collie, native Pack listener, or any
other service. A Peer whose configuration declares no terminal endpoint SHALL publish exactly the
first two projections, and its link SHALL be byte-identical to the link it established before this
change.

Every projection bind MUST be loopback. A wildcard, any-address, empty, or non-loopback bind MUST be
rejected by configuration validation before the connection is attempted. The runtime MUST NOT open a
dynamic, agent, X11, or additional port forward, and MUST NOT request a shell, a pseudo-terminal, or
remote command execution.

#### Scenario: The link comes up
- **WHEN** a schema-2 Peer with a valid transport configuration and no terminal endpoint starts
- **THEN** one SSH connection is established carrying exactly the configured remote and local loopback projections and nothing else

#### Scenario: The link comes up with a terminal endpoint
- **WHEN** a schema-2 Peer whose validated configuration declares a terminal endpoint starts
- **THEN** one SSH connection is established carrying exactly the two Pack projections plus the terminal projection, on a distinct Lead-side endpoint, and nothing else

#### Scenario: A projection cannot be established
- **WHEN** any configured projection cannot be bound on its side
- **THEN** the connection attempt fails visibly instead of remaining up with a direction missing, and the failure is reported as a link failure

#### Scenario: A non-loopback projection is configured
- **WHEN** a transport table names a wildcard, any-address, empty, or non-loopback bind for any projection
- **THEN** configuration validation fails with the qualified field name and no connection is attempted

#### Scenario: The terminal projection is aimed at another service
- **WHEN** a transport table gives the terminal projection the same Lead-side endpoint as the Pack projection, or aims it at the Peer's Collie or native Pack endpoint
- **THEN** configuration validation fails with the qualified field name and no connection is attempted
