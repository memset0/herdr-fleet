# fleet-plugin-runtime Specification

## Purpose

Defines the public-safe downstream plugin identity and the smallest owned runtime boundary needed to
run an authenticated Herdr Fleet lead while preserving the exact Collie baseline and its behavior.

## Requirements

### Requirement: The v3 line has an explicit downstream identity and provenance

The plugin SHALL identify itself as `memset0.herdr-fleet` and as Herdr Fleet while recording Collie
v1.2.0 tag object `0f98f28c9aaadd641c4bc5ac484190ee3ef7008c` and commit
`4618c90534d6f818ed6788b8db00e1582c5abfdc` as its initial upstream baseline. It MUST preserve
Collie's license and attribution, and it MUST NOT represent unchanged Collie behavior as downstream
functionality.

#### Scenario: Plugin metadata is inspected
- **WHEN** an operator or packaging tool reads the plugin metadata and fork provenance
- **THEN** it finds the downstream plugin id and name, the exact Collie v1.2.0 baseline, and retained upstream attribution without a private deployment reference

#### Scenario: The development candidate reports its lineage
- **WHEN** the v3 development candidate is built before an owner-approved release is cut
- **THEN** its output can be tied to an exact `v3-dev` commit without creating a release tag or claiming a different upstream baseline

### Requirement: Fleet-owned behavior stays outside upstream business logic

The authenticated Gateway, private configuration reader, session state, login presentation, proxy,
and Herdr-coupled lifecycle SHALL live in explicit downstream-owned roots. Any necessary edit to an
upstream-owned path MUST expose only a narrow identity, lifecycle, configuration, static-routing, or
service-worker port and MUST be listed exactly in `FORK.toml` with its reason and verification.

#### Scenario: A downstream behavior is added
- **WHEN** implementation places authentication, configuration, or lifecycle behavior in the source tree
- **THEN** the behavior resides in a declared owned root and any upstream-owned edit contains only the minimum adapter port recorded by the same change

#### Scenario: The fork boundary is audited
- **WHEN** the implemented tree is compared with the exact Collie baseline
- **THEN** every changed path is classified by `FORK.toml`, every invasive path has a specific reason and verification, and no unclassified downstream path remains

### Requirement: Herdr owns the role-aware Fleet runtime lifecycle
The plugin SHALL run the exact child composition selected by its validated Fleet configuration and
native Pack authority state without requiring Collie's Tailscale publication or a separately
installed operating-system service.

A schema-1 Lead SHALL continue to run one loopback Collie child and one loopback authenticated
Gateway child with unchanged inputs. A schema-2 Lead SHALL run the same two child kinds after native
Lead authority validation and after its reachability mapping is validated against native membership.
A schema-2 Peer SHALL run one local loopback Collie child plus one supervised reachability link child,
and MUST NOT start a Gateway, Fleet session store, browser-authentication listener, or public listener.

Start, stop, restart, status, and failed-start cleanup MUST act only on the plugin-owned generation,
MUST report the configured role and exact child set without secrets, and MUST leave unrelated Herdr
state and terminal panes unchanged. A link child that exits MUST be recovered under its own bounded
backoff without restarting the Collie child, and stopping the plugin MUST leave no orphaned link
process or published projection.

#### Scenario: Existing schema-1 Lead starts
- **WHEN** Herdr starts the plugin with an unchanged valid schema-1 Lead configuration
- **THEN** one loopback Gateway and one loopback Collie child become ready with the same observable configuration and status as before this change

#### Scenario: Schema-2 Lead starts
- **WHEN** Herdr starts a schema-2 Lead whose configuration, native Pack authority state, and reachability mapping agree
- **THEN** one loopback Gateway and one loopback Collie child become ready and status identifies the Lead role without exposing trust or browser secrets

#### Scenario: Schema-2 Peer starts
- **WHEN** Herdr starts a schema-2 Peer whose configuration and native Pack authority state agree
- **THEN** one loopback Collie child and one reachability link child become ready, no Gateway or browser listener exists, and status identifies the Peer role and the link layer separately

#### Scenario: The link child exits while Collie is healthy
- **WHEN** a schema-2 Peer's link child exits
- **THEN** only the link child is retried under bounded backoff, the Collie child keeps running, and status reports the Peer as not ready until the link is re-established

#### Scenario: Startup fails after a child was created
- **WHEN** a required child cannot become ready or configuration/authority/reachability validation fails
- **THEN** the attempted generation is cleaned up, no unintended listener or published projection is left behind, and unrelated Herdr processes and panes remain untouched

### Requirement: Upstream Tailscale support is retained but inactive in the Fleet profile

The fork SHALL retain Collie's upstream Tailscale serve and identity implementation for compatibility.
The Herdr Fleet lead profile MUST instead select external ingress, MUST NOT manage a Tailscale serve
mapping, and MUST treat its own password/session Gateway as the public browser authorization
boundary. A retained Tailscale header check MUST NOT be documented or reported as protecting a Fleet
profile that does not use it.

#### Scenario: Fleet profile starts
- **WHEN** the downstream plugin launches Collie behind its Gateway
- **THEN** Collie remains on loopback with Tailscale publication skipped and browser access is governed by the Fleet session boundary

#### Scenario: Upstream compatibility is reviewed
- **WHEN** a future upstream merge inspects the retained Tailscale implementation
- **THEN** the implementation remains available as upstream functionality while the downstream Fleet selection is isolated to owned configuration and lifecycle code

### Requirement: A check refuses a tree carrying a private fact
The repository SHALL carry a check that refuses a tracked tree containing a private fact, and that
check SHALL run as a commit-time guard independent of the others, with its own named escape hatch.

It SHALL detect by shape rather than by a list of forbidden values, because a list is the leak it
exists to prevent. The shapes it refuses SHALL include an IP address outside loopback and the
documentation ranges, an absolute path under a user's home directory, and material shaped like a
private key, a password verifier or a long opaque secret.

It SHALL scan the paths this fork declares as its own and no others, because a finding in an upstream
file that is already public upstream teaches its reader to ignore the guard.

Where a private value has no usable shape — a machine whose name is an ordinary word, and any
hostname, whose shape cannot be told from that of a public one — the check SHALL read those names from
the repository's ignored local context file when it is present, so they are caught without any of them
being written into the tree.

The publisher's own identity SHALL be exempt: the repository owner, the license attribution and the
stable plugin identifier are intentional public metadata and MUST NOT be reported.

The check SHALL state plainly what it does not cover, so a passing run is not read as a proof of
absence.

#### Scenario: A real deployment fact is committed
- **WHEN** a fork-owned tracked file gains a non-documentation address, a home-directory path, or credential-shaped material
- **THEN** the guard refuses the commit and names the file, the line and the shape it matched, without repeating any value it read from the local context file

#### Scenario: The same shape appears in an upstream file
- **WHEN** a file outside the fork's declared paths carries one of those shapes
- **THEN** the guard passes, because that file is upstream's to publish

#### Scenario: A synthetic example is committed
- **WHEN** a tracked file uses a reserved example domain, a loopback or documentation address, or a synthetic path
- **THEN** the guard passes

#### Scenario: The publisher is named
- **WHEN** a tracked file carries the repository owner, the license attribution or the plugin identifier
- **THEN** the guard passes, because that is the publisher's own identity

#### Scenario: A shapeless private name is committed
- **WHEN** a fork-owned tracked file gains a private machine or host name that carries no usable shape, and the local context file names it
- **THEN** the guard refuses, and when that file is absent the guard passes and its own output has already said that this is the case it cannot see

#### Scenario: The guard is in the way
- **WHEN** an operator must commit past it once
- **THEN** its own named hatch skips it and disarms neither the version, lint nor pack-wire guard
