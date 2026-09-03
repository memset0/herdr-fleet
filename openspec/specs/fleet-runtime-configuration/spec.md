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
MUST contain no public origin, browser account, session secret, Gateway listener, Host inventory,
transport endpoint, SSH key, SSH command, Pack secret, certificate, or membership row.

Every table SHALL reject unknown fields with a qualified diagnostic. Unsupported schema versions,
roles, lifecycle selections, Pack-state selections, or role-incompatible tables MUST fail before
authority validation or child startup rather than being ignored or partially activated.

#### Scenario: Existing schema-1 Lead configuration is parsed
- **WHEN** an unchanged valid schema-1 file is loaded after this change
- **THEN** it produces the same normalized Lead configuration and child inputs as before

#### Scenario: Schema-2 Lead configuration is parsed
- **WHEN** schema 2 declares a Lead, native-Pack lifecycle, Collie-managed Pack state, one loopback Collie endpoint, and complete Gateway tables
- **THEN** validation returns one immutable Lead configuration without transport or duplicated trust material

#### Scenario: Schema-2 Peer configuration is parsed
- **WHEN** schema 2 declares a Peer, native-Pack lifecycle, Collie-managed Pack state, and one loopback Collie endpoint only
- **THEN** validation returns one immutable Peer configuration with no Gateway or browser-authentication values

#### Scenario: Role-incompatible or deferred fields are supplied
- **WHEN** a Peer supplies a public/auth/listen/proxy table or either role supplies membership, SSH, transport, endpoint, key, command, or unknown fields
- **THEN** validation identifies the unsupported qualified field and startup performs no partial action

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
