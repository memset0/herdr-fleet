# fleet-pack-enrollment Specification

## Purpose

Defines how Herdr Fleet performs the first enrolment of a Pack peer using Collie's own transitions,
and the lifecycle boundary that keeps every Fleet deployment free of an operating-system service.

## Requirements

### Requirement: Fleet never depends on an operating-system service
Herdr Fleet SHALL NOT install, write, enable, start, stop or restart an operating-system service unit
on any host, and MUST NOT require a service manager to be present. Its lifecycle is the Herdr
plugin's: children are supervised by the plugin's own generation-owned supervisor, and a change that
must reach a running runtime is applied by restarting that plugin.

Fleet MUST NOT invoke Collie's own command-line verbs against a Fleet deployment. Those verbs resolve
an upstream plugin identity and a host supervision tier, so invoking one writes a foreign
configuration directory and takes a service-manager path Fleet does not own and may not have.

#### Scenario: A membership change must reach a running runtime
- **WHEN** an enrolment persists a change the running runtime read at boot
- **THEN** Fleet names the plugin restart that applies it and performs no process control of its own

#### Scenario: The host has no service manager
- **WHEN** Fleet runs on a rootless host with no service manager
- **THEN** every Fleet operation, enrolment included, completes without one

#### Scenario: An operator reaches for the upstream verbs
- **WHEN** documentation or a Fleet command describes a membership change
- **THEN** it directs the operator to Fleet's own command rather than a Collie CLI verb

### Requirement: Membership changes reuse Collie's own transitions
Herdr Fleet SHALL apply Collie's existing pure Pack transitions and persist them through Collie's
single trust-store update seam. It MUST NOT re-implement a transition, mint identity or invite
material of its own, define a second trust record, or introduce a second Pack wire shape; the request
and response of the exchange SHALL be the ones Collie already parses.

Fleet SHALL read no more of the trust store than the transition it applies requires, and MUST NOT
write a trust store on a host whose configured role does not match the change being made.

#### Scenario: An invite is minted
- **WHEN** an operator mints an invite on a lead
- **THEN** Collie's own mint transition produces it, Collie's own update seam persists it, and no Fleet-defined record is written

#### Scenario: An enrolment is accepted
- **WHEN** a peer completes the exchange
- **THEN** Collie's own acceptance transition persists the lead, the pinned certificate and the Pack secret, and Fleet stores nothing beside them

#### Scenario: A transition would be duplicated
- **WHEN** a change would need behaviour Collie's transitions do not expose
- **THEN** Fleet stops rather than implementing a second version of it

### Requirement: Enrolment is an explicit operator action with an ordered sequence
Enrolment SHALL happen only when an operator invokes it. Starting, restarting or supervising a Fleet
runtime MUST NOT mint, spend, accept, rotate or revoke anything.

The sequence SHALL be: the lead mints one single-use, short-lived invite; the plugin is restarted so
the running lead serves it; the peer spends it through the peer's own loopback projection of the
lead; the plugin is restarted on the lead so it serves the resulting roster. The invite MUST be read
from standard input or an owner-only file, MUST NOT appear in a command line, a log, a diagnostic or
a tracked file, and MUST be shown exactly once.

#### Scenario: A runtime starts
- **WHEN** any Fleet runtime starts, restarts or recovers a child
- **THEN** no membership is created, spent or altered

#### Scenario: An invite is supplied on the command line
- **WHEN** an operator passes invite material as an argument
- **THEN** the command refuses and names the standard-input and file forms instead

#### Scenario: The exchange fails midway
- **WHEN** the peer cannot reach the lead or the lead refuses the invite
- **THEN** neither side is left partially enrolled, the diagnostic names the layer that failed, and no secret appears in it
