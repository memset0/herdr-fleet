# fleet-runtime-configuration Specification

## Purpose

Defines the independent, private, role-aware runtime configuration consumed by Herdr Fleet without
turning Collie state or any real deployment configuration into public source material.

## Requirements

### Requirement: Fleet consumes one independent private configuration

The plugin SHALL load one `fleet.toml` from its operator-selected or Herdr-provided configuration
directory as the source of truth for Fleet role and lifecycle selection. The file MUST be separate
from Collie's `.env`, Pack trust store, Pack operations store, browser storage, and repository-local
examples. It MUST reference Collie-managed native Pack state only through the closed schema-2
lifecycle selection and MUST NOT duplicate membership, identity, certificate, secret, signature,
address, or trust records.

The runtime MUST NOT infer a live configuration from source-tree contents or silently fall back to
Collie defaults for a required Fleet security value. Concrete transport reachability remains outside
this schema and MUST NOT be inferred from Pack member addresses.

#### Scenario: A valid configuration is loaded
- **WHEN** the plugin starts with an explicitly resolved owner-only schema-1 or schema-2 `fleet.toml`
- **THEN** it derives the schema's exact Fleet role, lifecycle selection, role-appropriate loopback listeners, and Collie child settings before starting a child

#### Scenario: A valid schema-2 configuration is loaded
- **WHEN** the plugin starts with an explicitly resolved owner-only schema-2 `fleet.toml`
- **THEN** it derives the exact Fleet role, native-Pack lifecycle selection, role-appropriate loopback listeners, and Collie state reference before starting a child

#### Scenario: No live configuration exists
- **WHEN** the configured file is absent or cannot be resolved
- **THEN** startup fails closed without creating a Gateway, Collie child, public route, default credential, generated live configuration, or Pack state

### Requirement: Configuration schemas are strict and backward compatible
Schema version 1 SHALL retain its existing lead-only grammar and normalized behavior unchanged.
Schema version 2 SHALL require `role = "lead"` or `role = "peer"`, one `[lifecycle]` table with
`mode = "native-pack"` and `pack_state = "collie"`, and one loopback `[collie]` endpoint.

A schema-2 Lead SHALL require the existing `[listen]`, `[public]`, `[auth]`, and optional `[proxy]`
tables used by the authenticated Gateway. A schema-2 Peer MUST reject those Lead-only tables and
MUST contain no public origin, browser account, session secret, Gateway listener, or Host inventory.

A schema-2 Peer SHALL additionally require one `[transport]` table naming exactly: the single
supported link mode, the Lead's SSH endpoint and account, an owner-only SSH identity path, a pinned
`known_hosts` path, the Lead-side loopback endpoint the Lead will dial this Peer at, the Peer-side
loopback endpoint that projects the Lead, the Lead's Collie loopback endpoint behind that projection,
and the bounded retry ceiling. The Peer's own projected endpoint SHALL be derived from its validated
`[collie]` table rather than restated. A schema-2 Lead SHALL accept an optional `[[reachability]]`
list whose entries carry exactly a member id and one loopback endpoint.

Neither table MAY carry a certificate, fingerprint, Pack secret, private key, password, remote
command, membership row, or any other trust material, and a Lead MUST reject `[transport]` while a
Peer MUST reject `[[reachability]]`. Every table SHALL reject unknown fields with a qualified
diagnostic. Unsupported schema versions, roles, lifecycle selections, Pack-state selections, link
modes, non-loopback projection binds, or role-incompatible tables MUST fail before authority
validation or child startup rather than being ignored or partially activated.

#### Scenario: Existing schema-1 Lead configuration is parsed
- **WHEN** an unchanged valid schema-1 file is loaded after this change
- **THEN** it produces the same normalized Lead configuration and child inputs as before

#### Scenario: Schema-2 Lead configuration is parsed
- **WHEN** schema 2 declares a Lead, native-Pack lifecycle, Collie-managed Pack state, one loopback Collie endpoint, complete Gateway tables, and a reachability list of member ids with loopback endpoints
- **THEN** validation returns one immutable Lead configuration whose reachability entries carry no trust material

#### Scenario: Schema-2 Peer configuration is parsed
- **WHEN** schema 2 declares a Peer, native-Pack lifecycle, Collie-managed Pack state, one loopback Collie endpoint, and one complete transport table
- **THEN** validation returns one immutable Peer configuration with no Gateway or browser-authentication values and both projections resolved to loopback endpoints

#### Scenario: Role-incompatible or deferred fields are supplied
- **WHEN** a Peer supplies a public/auth/listen/proxy or reachability table, a Lead supplies a transport table, or either role supplies membership, key, certificate, secret, command, or unknown fields
- **THEN** validation identifies the unsupported qualified field and startup performs no partial action

#### Scenario: An unsupported link mode is supplied
- **WHEN** a transport table names any link mode other than the single supported one
- **THEN** validation fails with the qualified field name rather than accepting a mode with no runtime behind it

#### Scenario: An unknown field is supplied
- **WHEN** any configuration table contains a field outside its exact schema
- **THEN** validation fails with the field's qualified name instead of accepting a typo or silently discarding it

### Requirement: Configuration and runtime state remain owner-only and untracked

The live `fleet.toml`, password hash, session-signing secret, active session state, logs, and runtime
files MUST remain outside the tracked repository and MUST be accessible only to their operating-system
owner on platforms that expose POSIX permissions. Public source MAY describe the generic schema and
MAY use synthetic values in tests, but MUST NOT contain a usable live configuration, credential,
deployment hostname, device mapping, private path, or infrastructure topology.

#### Scenario: File permissions are too broad
- **WHEN** a live configuration or session-state file is accessible by group or other users
- **THEN** the component refuses to consume it and does not print its sensitive contents

#### Scenario: The public tree is audited
- **WHEN** tracked source, tests, documentation, OpenSpec artifacts, and history are scanned
- **THEN** no live `fleet.toml`, real credential, deployment identity, private host mapping, or machine-local state is present

### Requirement: Configuration keeps secrets out of diagnostics

Configuration validation, status, logs, and error responses SHALL identify invalid field names and
safe runtime states without emitting submitted passwords, password hashes, session secrets, signed
cookies, private-key contents, or complete authentication tokens.

#### Scenario: Sensitive configuration is malformed
- **WHEN** an authentication or secret field fails validation
- **THEN** the diagnostic names the field and required shape without echoing its supplied value

#### Scenario: Status is requested
- **WHEN** an operator reads plugin status after successful startup
- **THEN** it can verify role, listener readiness, upstream readiness, and authentication enforcement without receiving secret material

### Requirement: The lead's pack timing is part of its private configuration
The private configuration SHALL carry an optional section stating the lead's poll interval and its
per-peer probe budget, validated like every other field, and Fleet SHALL pass both to Collie as the
environment variables Collie already reads. Both SHALL be reset before they are set, so the
configuration decides them and an inherited environment cannot.

Omitting the section SHALL leave both untouched, so an existing deployment keeps upstream's defaults
without being edited. The section SHALL be meaningful on a lead only; a peer's configuration neither
requires nor is changed by it.

Fleet SHALL NOT reproduce, widen or bypass upstream's own ceiling on the budget. A budget above the
poll interval is what that ceiling exists to prevent, so a fleet that wants a longer budget states a
longer poll interval beside it.

#### Scenario: A fleet with distant members is configured
- **WHEN** the configuration states a poll interval and a per-peer budget
- **THEN** Collie is started with exactly those two values and the budget it grants follows its own arithmetic

#### Scenario: The section is omitted
- **WHEN** a configuration carries no such section
- **THEN** neither variable is set and the deployment keeps the defaults it had

#### Scenario: A budget above the ceiling is asked for
- **WHEN** the stated budget exceeds what the stated poll interval allows
- **THEN** the configuration is still valid, upstream's clamp decides what is granted, and the record shows both what was asked and what was granted

### Requirement: A member never heard from is not a refusal
The navigation rail SHALL treat a member the lead has never heard from as a distinct state from one
whose receipt has aged past a missed sweep. A receipt of zero means the lead has not yet heard from
that member at all, and subtracting it yields an age no threshold can survive — which turned a member
enrolled a moment ago, or one whose lead had just restarted, into a refusal on its first sweep.

Where the lead reports that a member answers but misses its budget, the rail SHALL say that rather
than presenting it as a refusal. The lead already distinguishes the two and states which it means.

#### Scenario: A member has just been enrolled
- **WHEN** the lead has not yet recorded a receipt from a member
- **THEN** the rail does not present it as refusing, and waits for a real receipt to age

#### Scenario: A member answers slowly
- **WHEN** the lead reports a member as answering while missing its probe budget
- **THEN** the rail says the link is slow rather than that the member refused

#### Scenario: A member stops answering
- **WHEN** the lead refuses a member and its last receipt is older than a missed sweep
- **THEN** the rail presents it as refusing, exactly as it does today
