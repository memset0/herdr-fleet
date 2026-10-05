## MODIFIED Requirements

### Requirement: One Peer-originated link carries both loopback projections
A schema-2 Peer selecting `ssh-reverse` SHALL open exactly one outbound SSH connection to the Lead's operator-configured SSH
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
- **WHEN** a schema-2 Peer using `ssh-reverse` with a valid transport configuration and no terminal endpoint starts
- **THEN** one SSH connection is established carrying exactly the configured remote and local loopback projections and nothing else

#### Scenario: The link comes up with a terminal endpoint
- **WHEN** a schema-2 Peer using `ssh-reverse` whose validated configuration declares a terminal endpoint starts
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

### Requirement: The link is restricted, owner-owned and recovered with bounded backoff
A Peer selecting `ssh-reverse` SHALL own its own link. Fleet MUST run it as one supervised child beside Collie, using an
owner-only SSH identity file and an operator-supplied pinned `known_hosts`, with strict host-key
checking, no agent forwarding, no X11 forwarding, no connection multiplexing, no inherited user SSH
configuration, and no secret on the command line.

A failed or dropped link SHALL be retried by the Peer with bounded exponential backoff up to a
configured maximum interval, without unbounded immediate retries and without restarting the Collie
child. The Lead MUST NOT create, adopt, or repair a Peer's outbound connection.

#### Scenario: The link drops
- **WHEN** an established link is lost
- **THEN** the Peer retries with increasing bounded delay while its Collie child keeps running unchanged

#### Scenario: Host-key verification fails
- **WHEN** the Lead's host key is absent from or disagrees with the pinned `known_hosts`
- **THEN** the connection is refused, the failure is reported, and no projection is published

#### Scenario: Identity material is world-readable
- **WHEN** the configured SSH identity file is accessible beyond its owner on a platform exposing POSIX permissions
- **THEN** startup fails closed without attempting the connection and without printing key contents

### Requirement: Link state is reported as its own layer
Readiness and status SHALL report the link as a layer distinct from the Collie child and from Pack
authentication, so an operator can tell "the link is not established" from "the link is up and Pack
refused it".

A schema-2 Peer selecting `ssh-reverse` SHALL become ready only when its Collie child is ready and its link is established.
Status MUST name the link's state and its retry posture without emitting the SSH identity, key
material, host key, Pack secret, certificate, or any browser credential.

#### Scenario: Peer readiness is evaluated
- **WHEN** an `ssh-reverse` Peer's Collie child is ready but its link is not established
- **THEN** the Peer is not ready and status names the link as the unmet layer

#### Scenario: Status is requested during backoff
- **WHEN** an operator reads status while the link is retrying
- **THEN** status reports the link state and retry posture with no secret material

## ADDED Requirements

### Requirement: External transport remains operator-owned
A peer selecting `external` SHALL start its ordinary authenticated local services without starting, reading credentials for, supervising, replacing or repairing an SSH connection. The operator SHALL own every projection in both directions. Fleet SHALL retain native authority validation and end-to-end crew security unchanged. A loopback listener SHALL NOT imply membership or authenticated reachability.

Local readiness SHALL depend on Fleet-owned services rather than an external connection. Control status SHALL explicitly report external transport and no link child. A missing or returning external projection MUST NOT cause Fleet to start a tunnel, restart Collie, modify trust or stop the multiplexer. End-to-end connectivity SHALL remain the native lead census's observation.

#### Scenario: An external projection is absent
- **WHEN** an enrolled external peer starts while its operator's projections are absent
- **THEN** its local services can become ready, status declares external ownership without asserting connectivity, and Fleet launches no SSH process

#### Scenario: The operator restores a projection
- **WHEN** the external path becomes available after local startup
- **THEN** the existing services answer through that path with unchanged trust and no lifecycle restart
