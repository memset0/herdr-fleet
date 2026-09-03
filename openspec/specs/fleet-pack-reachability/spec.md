# fleet-pack-reachability Specification

## Purpose

Defines the operator-configured SSH underlay that makes a native Pack member dialable in both
directions, and the boundary that keeps that underlay from ever becoming a membership or identity
authority.

## Requirements

### Requirement: One Peer-originated link carries both loopback projections
A schema-2 Peer SHALL open exactly one outbound SSH connection to the Lead's operator-configured SSH
endpoint and SHALL carry both reachability directions on that single connection.

The connection SHALL publish exactly two projections and no others:

- a remote projection binding the configured Lead-side loopback endpoint to the Peer's own validated
  `[collie]` endpoint, so the Lead dials the Peer's native Pack listener at a Lead-local address;
- a local projection binding the configured Peer-side loopback endpoint to the Lead's configured
  Collie loopback endpoint, so the Peer reaches the Lead through the same connection.

Both projection binds MUST be loopback. A wildcard, any-address, empty, or non-loopback bind MUST be
rejected by configuration validation before the connection is attempted. The runtime MUST NOT open a
dynamic, agent, X11, or additional port forward, and MUST NOT request a shell, a pseudo-terminal, or
remote command execution.

#### Scenario: The link comes up
- **WHEN** a schema-2 Peer with a valid transport configuration starts
- **THEN** one SSH connection is established carrying exactly the configured remote and local loopback projections and nothing else

#### Scenario: A projection cannot be established
- **WHEN** either configured projection cannot be bound on its side
- **THEN** the connection attempt fails visibly instead of remaining up with one direction missing, and the failure is reported as a link failure

#### Scenario: A non-loopback projection is configured
- **WHEN** a transport table names a wildcard, any-address, empty, or non-loopback bind for either projection
- **THEN** configuration validation fails with the qualified field name and no connection is attempted

### Requirement: Reachability is transport only and never an identity assertion
An established link SHALL grant nothing beyond TCP reachability. Herdr Fleet MUST NOT treat a live
link as membership, admission, authorization, or proof of role, and MUST NOT treat a dead link as
revocation, removal, demotion, or a reason to alter Pack trust state.

Collie's pinned mutual TLS and Pack secret SHALL remain the only factors that admit a member, unchanged
and evaluated end to end inside the link. Fleet MUST NOT terminate, inspect, downgrade, re-encrypt, or
substitute Pack transport security, MUST NOT derive a member identity from a port, address, or link,
and MUST NOT accept a member because a process was able to bind a projection.

#### Scenario: The link is up but Pack authentication fails
- **WHEN** the link is established and Collie refuses the Pack link on certificate or secret grounds
- **THEN** Fleet reports a Pack authentication failure, leaves the link classification unchanged, and admits nothing

#### Scenario: The link is down
- **WHEN** the link is not established
- **THEN** Fleet reports the member as unreachable, changes no Pack trust state, and removes no membership

#### Scenario: Another process occupies a projection endpoint
- **WHEN** a Lead-side loopback projection endpoint is served by something other than the enrolled Peer
- **THEN** admission still depends entirely on Collie's pinned certificate and Pack secret, and Fleet grants nothing on the strength of the address

### Requirement: The link is restricted, owner-owned and recovered with bounded backoff
The Peer SHALL own its own link. Fleet MUST run it as one supervised child beside Collie, using an
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

A schema-2 Peer SHALL become ready only when its Collie child is ready and its link is established.
Status MUST name the link's state and its retry posture without emitting the SSH identity, key
material, host key, Pack secret, certificate, or any browser credential.

#### Scenario: Peer readiness is evaluated
- **WHEN** a schema-2 Peer's Collie child is ready but its link is not established
- **THEN** the Peer is not ready and status names the link as the unmet layer

#### Scenario: Status is requested during backoff
- **WHEN** an operator reads status while the link is retrying
- **THEN** status reports the link state and retry posture with no secret material

### Requirement: A Lead's reachability mapping projects native membership and never defines it
A schema-2 Lead's configured reachability mapping SHALL contain exactly one loopback endpoint per
enrolled member id and SHALL be validated against Collie's Pack trust state through the existing
read-only authority seam before any child starts.

The configured member id set MUST equal the enrolled member set Collie reports. A member present in
one and absent from the other MUST fail startup, and validation MUST NOT create, remove, rename, or
otherwise modify a member, a roster row, or any trust record. The mapping MUST carry no certificate,
fingerprint, secret, key, account, or command.

#### Scenario: Mapping and roster agree
- **WHEN** a schema-2 Lead's reachability mapping names exactly the enrolled member ids
- **THEN** validation succeeds without changing Pack trust state and the Lead starts its configured children

#### Scenario: Mapping and roster disagree
- **WHEN** the mapping names a member Collie has not enrolled, or omits one it has
- **THEN** startup fails closed, naming the disagreement, and Pack trust state is left byte-for-byte unchanged

#### Scenario: Trust material is supplied in the mapping
- **WHEN** a reachability entry carries a certificate, fingerprint, secret, key, account, or command field
- **THEN** configuration validation rejects the qualified field and no partial reachability is activated
