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
