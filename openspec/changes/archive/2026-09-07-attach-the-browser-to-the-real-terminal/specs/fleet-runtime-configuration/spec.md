## MODIFIED Requirements

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

A schema-2 Peer MAY additionally declare one optional `[terminal]` table naming exactly: the Peer's
own loopback terminal endpoint, the Lead-side loopback endpoint the Lead will reach that terminal
service at, the terminal server executable's path and its expected identity, the bounded idle interval
after which the terminal service stands down, and the bounded maximum number of concurrent terminal
servers. A schema-2 Lead MAY extend each `[[reachability]]` entry with one optional loopback terminal
endpoint for that member. Both terminal endpoints SHALL be loopback, the Peer's Lead-side terminal
endpoint MUST differ from its Pack projection's Lead-side endpoint, and the idle interval and server
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
- **WHEN** a transport table names any link mode other than the single supported one
- **THEN** validation fails with the qualified field name rather than accepting a mode with no runtime behind it

#### Scenario: An unknown field is supplied
- **WHEN** any configuration table contains a field outside its exact schema
- **THEN** validation fails with the field's qualified name instead of accepting a typo or silently discarding it
