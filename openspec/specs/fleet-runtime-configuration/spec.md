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

A schema-2 Peer SHALL require one `[transport]` table selecting `ssh-reverse` or `external`. The `ssh-reverse` variant SHALL retain its existing exact grammar and normalized behavior. The `external` variant SHALL accept only `mode`, `peer_bind_host` and `peer_bind_port`, naming the loopback projection of the Lead that the operator supplies. It MUST reject SSH endpoints, accounts, identity paths, known-hosts paths, retry options and commands. Its local projection MUST differ from Collie and any declared terminal bind. A schema-2 Lead SHALL retain its optional member-to-loopback `[[reachability]]` mapping.

A schema-2 Peer MAY additionally declare one optional `[terminal]` table naming exactly: the Peer's
own loopback terminal endpoint, the Lead-side loopback endpoint the Lead will reach that terminal
service at, the terminal server executable's path and its expected identity, the bounded idle interval
after which the terminal service stands down, and the bounded maximum number of concurrent terminal
servers. A schema-2 Lead MAY extend each `[[reachability]]` entry with one optional loopback terminal
endpoint for that member. Both terminal endpoints SHALL be loopback; for `ssh-reverse`, the Peer's Lead-side terminal
endpoint MUST differ from its Pack projection's Lead-side endpoint. The idle interval and server
maximum MUST fall within declared bounds. A configuration that omits the terminal fields SHALL
normalize exactly as it did before this change and MUST NOT acquire a default terminal endpoint.

Neither table MAY carry a certificate, fingerprint, Pack secret, private key, password, remote
command, terminal id, membership row, or any other trust material, and a Lead MUST reject
`[transport]` and `[terminal]` while a Peer MUST reject `[[reachability]]`. Every table SHALL reject
unknown fields with a qualified diagnostic. Unsupported schema versions, roles, lifecycle selections,
Pack-state selections, link modes, non-loopback projection or terminal binds, out-of-range terminal
bounds, colliding Lead-side endpoints, or role-incompatible tables MUST fail before authority
validation or child startup rather than being ignored or partially activated.

#### Scenario: Existing schema-1 Lead configuration is parsed
- **WHEN** an unchanged valid schema-1 file is loaded after this change
- **THEN** it produces the same normalized Lead configuration and child inputs as before

#### Scenario: Schema-2 Lead configuration is parsed
- **WHEN** schema 2 declares a Lead, native-Pack lifecycle, Collie-managed Pack state, one loopback Collie endpoint, complete Gateway tables, and a reachability list of member ids with loopback endpoints
- **THEN** validation returns one immutable Lead configuration whose reachability entries carry no trust material

#### Scenario: Schema-2 Peer configuration is parsed
- **WHEN** schema 2 declares a Peer, native-Pack lifecycle, Collie-managed Pack state, one loopback Collie endpoint, and one complete transport table
- **THEN** validation returns one immutable Peer configuration with no Gateway or browser-authentication values, both projections resolved to loopback endpoints, and no terminal endpoint

#### Scenario: Schema-2 Peer declares a terminal table
- **WHEN** a schema-2 Peer declares a complete `[terminal]` table with loopback endpoints, an in-range idle interval and server maximum, and a Lead-side terminal endpoint distinct from its Pack projection's
- **THEN** validation returns one immutable Peer configuration carrying the terminal endpoints and bounds, with no terminal id, command, or trust material

#### Scenario: A terminal table collides or is out of range
- **WHEN** a `[terminal]` table names a non-loopback bind, reuses the Pack projection's Lead-side endpoint, or gives an idle interval or server maximum outside its declared bounds
- **THEN** validation fails with the qualified field name and no child is started

#### Scenario: Role-incompatible or deferred fields are supplied
- **WHEN** a Peer supplies a public/auth/listen/proxy or reachability table, a Lead supplies a transport or terminal table, or either role supplies membership, key, certificate, secret, command, terminal id, or unknown fields
- **THEN** validation identifies the unsupported qualified field and startup performs no partial action

#### Scenario: An unsupported link mode is supplied
- **WHEN** a transport table names a link mode other than `ssh-reverse` or `external`
- **THEN** validation fails with the qualified field name rather than accepting a mode with no runtime behind it

#### Scenario: An unknown field is supplied
- **WHEN** any configuration table contains a field outside its exact schema
- **THEN** validation fails with the field's qualified name instead of accepting a typo or silently discarding it

#### Scenario: External transport is selected
- **WHEN** a schema-2 peer declares external transport with one distinct loopback Lead projection
- **THEN** it validates without requiring or reading SSH credentials or creating a transport

#### Scenario: External transport includes SSH fields
- **WHEN** external transport includes an SSH field, command or unknown key
- **THEN** validation refuses the qualified field before starting a child

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
environment variables the adopted Collie reads under their current names. Both SHALL be reset before
they are set, so the configuration decides them and an inherited environment cannot.

Fleet SHALL reset and set only the names the adopted Collie reads. A spelling Collie no longer reads
decides nothing, and Fleet SHALL NOT carry a reset for it.

The section's own name and keys belong to this product's configuration and SHALL NOT change because
Collie renamed its variables; an existing configuration SHALL keep working without being edited.

Omitting the section SHALL leave both untouched, so an existing deployment keeps upstream's defaults
without being edited. The section SHALL be meaningful on a lead only; a peer's configuration neither
requires nor is changed by it.

Fleet SHALL NOT reproduce, widen or bypass upstream's own ceiling on the budget. A budget above the
poll interval is what that ceiling exists to prevent, so a fleet that wants a longer budget states a
longer poll interval beside it.

#### Scenario: A fleet with distant members is configured
- **WHEN** the configuration states a poll interval and a per-peer budget
- **THEN** Collie is started with exactly those two values under the variable names it currently reads, and the budget it grants follows its own arithmetic

#### Scenario: The inherited environment carries a value for either variable
- **WHEN** Fleet starts Collie from an environment that already holds the poll interval or the budget
- **THEN** that value is removed, and Collie sees only what the configuration states or nothing at all

#### Scenario: The inherited environment carries the previous variable name
- **WHEN** Fleet starts Collie from an environment that holds the budget under a spelling the adopted Collie no longer reads
- **THEN** that value decides nothing, Fleet neither sets nor projects it, and the budget is what the configuration states or Collie's default

#### Scenario: An existing configuration is carried across the adoption
- **WHEN** a configuration written for the previous release is loaded unchanged
- **THEN** it validates and projects the same two values, with no key renamed

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

### Requirement: Fleet states where its Collie child keeps its state
Fleet SHALL start its Collie child with that child's state directory stated explicitly under the
variable the adopted Collie reads for it, reset before it is set, and it SHALL be the same directory
Fleet validates the crew trust state in and the one an explicit enrolment writes. Neither an
inherited environment, a variable the adopted Collie no longer reads, nor Collie's own default
location SHALL decide it.

An adoption that changes how Collie resolves its state directory SHALL NOT move the directory: the
state an existing deployment holds stays where it is and is read in place.

#### Scenario: The plugin starts after the adoption
- **WHEN** Fleet starts Collie on a machine whose Collie state already exists under Fleet's state directory
- **THEN** Collie opens that same directory, finds the crew trust state Fleet validated, and starts in the mode Fleet expected

#### Scenario: The inherited environment names another state directory
- **WHEN** Fleet is started from an environment that carries a Collie state-directory value of its own
- **THEN** the Collie child receives Fleet's directory instead, and validation and Collie read the same trust store

### Requirement: Collie's own configuration files cannot decide a Fleet-owned setting
The adopted Collie reads a machine-wide and an instance configuration file beneath its environment.
For every Collie setting Fleet owns — the Collie child's state directory, its bind host and port and
the loopback guards around them, its ingress, origin, public-host and trusted-identity settings, the
adopted Collie's own Cloudflare Access gate (its team and audience), its serve publication, the base path it is served under, and the lead's crew timing — Fleet SHALL
reset the variable in the child's environment and, where Fleet decides the value, set it, so the
environment Fleet hands Collie is what decides it.

Where Fleet leaves such a setting unset on purpose, so Collie keeps its default, a configuration file
could otherwise supply it. Fleet SHALL therefore read both files Collie will read, through Collie's
own reader and from the paths Collie will resolve for that child, and SHALL refuse to start the
generation when either file sets a Fleet-owned setting. The refusal SHALL name the file and the
setting and MUST NOT print the value. A file that sets only settings Fleet does not own SHALL be left
to Collie, and Fleet SHALL NOT write, create or rewrite either file.

#### Scenario: No Collie configuration file exists
- **WHEN** neither Collie configuration file is present
- **THEN** Fleet starts Collie exactly as it did before the adoption

#### Scenario: A Collie configuration file sets a setting Fleet does not own
- **WHEN** a Collie configuration file sets, for example, a speech-to-text or reader setting
- **THEN** Fleet starts normally and Collie applies that setting under its own precedence

#### Scenario: A Collie configuration file sets a Fleet-owned setting
- **WHEN** either Collie configuration file sets the bind, the base path, a trusted identity, the state directory or another Fleet-owned setting
- **THEN** the generation does not start, and the diagnostic names the file and the setting without its value

#### Scenario: The base path is asked for through the environment
- **WHEN** Fleet is started from an environment that carries a Collie base path
- **THEN** the Collie child receives none, and Collie keeps serving at the root the Gateway proxies

#### Scenario: Collie's Access gate is asked for
- **WHEN** a Collie configuration file, or the environment Fleet is started from, names a Cloudflare Access team or audience
- **THEN** a file refuses the generation, naming the file and the setting without its value, and an inherited value never reaches the Collie child, so the Gateway remains the only authentication in front of Collie
