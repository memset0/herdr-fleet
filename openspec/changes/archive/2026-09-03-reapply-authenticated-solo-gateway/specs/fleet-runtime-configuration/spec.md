## Purpose

Defines the independent, private, role-aware runtime configuration consumed by Herdr Fleet without
turning Collie state or any real deployment configuration into public source material.

## ADDED Requirements

### Requirement: Fleet consumes one independent private configuration
The plugin SHALL load one `fleet.toml` from its operator-selected or Herdr-provided configuration
directory as the source of truth for Fleet runtime behavior. The file MUST be separate from Collie's
`.env`, Pack trust store, Pack operations store, browser storage, and repository-local examples. The
runtime MUST NOT infer a live configuration from source-tree contents or silently fall back to
Collie defaults for a required Fleet security value.

#### Scenario: A valid configuration is loaded
- **WHEN** the plugin starts with an explicitly resolved owner-only `fleet.toml`
- **THEN** it derives the Fleet role, public origin, authentication settings, loopback listeners, and Collie child settings from that file before starting a child

#### Scenario: No live configuration exists
- **WHEN** the configured file is absent or cannot be resolved
- **THEN** startup fails closed without creating a Gateway, Collie child, public route, default credential, or generated live configuration

### Requirement: The first configuration schema is strictly lead-only
Schema version 1 in this change SHALL require `role = "lead"` and exactly one local Collie upstream.
It SHALL accept only lead/solo public-authentication, UI placeholder, lifecycle, and local-upstream
fields needed by this change. Peer role, host inventory, SSH transport, Pack routing, tunnel retry,
and remote update fields MUST be rejected as unsupported rather than ignored or partially activated.

#### Scenario: The first lead configuration is accepted
- **WHEN** a schema-version-1 file declares the lead role and one valid loopback Collie upstream with all required authentication and public-origin fields
- **THEN** validation returns one complete immutable lead configuration with no inferred peer or transport behavior

#### Scenario: Deferred multi-host configuration is supplied early
- **WHEN** a schema-version-1 file declares a peer role, host inventory, SSH transport, or Pack routing field
- **THEN** validation identifies the unsupported field or role and startup performs no partial multi-host action

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
