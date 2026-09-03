## Purpose

Defines the public-safe downstream plugin identity and the smallest owned runtime boundary needed to
run an authenticated Herdr Fleet lead while preserving the exact Collie baseline and its behavior.

## ADDED Requirements

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

### Requirement: Herdr owns the Fleet runtime lifecycle
The plugin SHALL run its lead/solo Gateway and Collie children as one Herdr-owned runtime without
requiring Collie's Tailscale publication or a separately installed operating-system service. Start,
stop, restart, status, and failed-start cleanup MUST act only on the plugin-owned generation and MUST
leave unrelated Herdr state and terminal panes unchanged.

#### Scenario: The lead starts successfully
- **WHEN** Herdr starts the plugin with a valid lead configuration
- **THEN** one loopback Gateway and one loopback Collie child become ready under the plugin-owned lifecycle without configuring Tailscale or installing an operating-system service

#### Scenario: Startup fails after one child was created
- **WHEN** either child cannot become ready or the configuration becomes invalid during startup
- **THEN** the attempted generation is cleaned up, no public listener is created, and unrelated Herdr processes and panes remain untouched

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
