## Context

See `proposal.md` and the three delta specs. Collie v1.2.0 already reads
`pack-trust.json` once at bridge boot, derives `solo | lead | peer` from that roster, owns every Pack
credential and mutation, disables browser routes in Peer mode, and exposes the native Pack router,
loaders, and UI. Fleet currently parses one schema-1 Lead shape, forces Collie onto loopback behind
the Gateway, and always supervises Collie plus Gateway.

## Goals / Non-Goals

**Goals:**

- Preserve schema-1 parsing, normalized values, child environment, child order, status text, and
  readiness behavior.
- Add one strict schema-2 discriminated union for native-Pack Lead and Peer lifecycle.
- Validate schema-2 role against Collie's trust state through Collie's existing reader and mode
  derivation without writing it.
- Keep browser credentials and session state on the Gateway side of the runtime.
- Make child composition, readiness, cleanup, and status derive from the validated role.

**Non-Goals:**

- A new Pack protocol, trust reader, enrollment path, secret transition, router, loader, or UI.
- Any SSH configuration, transport process, reachability projection, remote dial, or peer fixture.
- Host aggregation, remote actions, software distribution, deputy behavior, deployment changes, or
  a migration of existing schema-1 staging.

## Decisions

### 1. Add schema 2 as a union instead of widening schema 1

Keep the schema-1 parser and normalized Lead object as a distinct branch. Add schema-2 branches:

- both roles require `schema_version = 2`, `role`, `[lifecycle]` with
  `mode = "native-pack"` and `pack_state = "collie"`, plus one loopback `[collie]` endpoint;
- a Lead additionally requires the existing `[listen]`, `[public]`, `[auth]`, and optional `[proxy]`
  tables;
- a Peer rejects every Gateway/browser-authentication table.

The root and every table retain exact-key validation. The lifecycle literals are references, not
paths or credentials: Fleet always resolves Pack state from the Collie child's existing isolated
state directory. No transport table is admitted.

Alternatives rejected:

- Add optional role fields to schema 1: silently changes the meaning of existing files and makes
  incompatible field combinations difficult to reject.
- Put a trust-store path or Pack members in `fleet.toml`: creates a second authority and lets
  configuration redirect security-sensitive reads.
- Add opaque reachability ids now: no runtime consumes them until the SSH change, so accepting them
  would create an unverified dormant contract.

### 2. Validate authority in one read-only owned module before child construction

Add `fleet/pack-authority.ts`. For schema 2 it constructs Collie's existing `TrustStore` at the
already-derived Collie state directory, calls `load()`, passes the result through
`enrollmentOf()`/`deriveMode()`, and requires a non-conflicting mode equal to the configured role.
`solo`, missing, unreadable, invalid, or mismatched state fails before any child starts.

The module exposes a narrow injected reader seam for focused tests. Production uses only
`TrustStore.load()`; it never calls `update()`, creates directories, generates identity, or imports
enrollment/rotation transitions. Schema 1 bypasses this validation entirely.

Alternatives rejected:

- Parse `pack-trust.json` again under `fleet/`: duplicates security validation and can drift from
  Collie.
- Ask the running Collie for `/api/config`: starts the child before role validation and turns
  authority into behavior probing.
- Accept `solo` for a schema-2 Lead: claims native Pack lifecycle while no active Pack membership
  exists; schema 1 remains the explicit solo-compatible path.

### 3. Derive exact children and readiness from the validated config

Keep one Collie child for every branch. Schema-1 and schema-2 Leads add the existing Gateway child;
schema-2 Peer does not. Preserve child order (`collie`, then `gateway`) for Leads.

Refactor readiness by role: a Lead checks Collie `/api/config` and Gateway `/auth/login`; a Peer
checks that the Collie loopback TCP listener accepts a connection because native Peer mTLS correctly
refuses an unauthenticated HTTP readiness request. Child cleanup remains the current generation-owned
`ManagedChild` flow. Control responses gain an optional role emitted only for schema 2, so schema-1
serialized responses and formatted status remain unchanged; schema-2 status adds the role and
reports only its actual children.

Alternatives rejected:

- Start a dormant Gateway on Peer: still creates a browser/session surface and contradicts the
  single-purpose Peer runtime.
- Give Peer a second Pack child: Collie's own bridge already owns the native loopback Pack listener.

### 4. Keep Collie environment role-aware and credential-free

Continue clearing inherited Collie network/trust bypasses and forcing a loopback bind plus
`COLLIE_SKIP_SERVE=1`. A Lead receives its public Host/Origin values so normal native UI/API behavior
continues through Gateway. A Peer receives none of those public browser values.

Neither branch receives Fleet credential values, session state, cookie material, Pack secret, TLS
material, or membership rows from Fleet. Collie finds its own Pack state under its isolated state
directory exactly as it already does. Gateway retains the only Fleet session-store pointer.

### 5. Preserve the public Pack denial and native product surfaces

The existing Gateway denial for `/pack/*` remains before browser-session proxying and gains focused
authenticated coverage. No `bridge/`, `web/`, `PACK_PROTOCOL.md`, or upstream-owned runtime path is
changed. `FORK.toml` extends only the existing `fleet-runtime` contract and verification list; no
redundant owned block or invasive port is added.

## Risks / Trade-offs

- **[A role typo could open the wrong surface]** → Exact schema validation plus trust-derived mode
  agreement runs before children exist; conflicts resolve to startup failure.
- **[Reading trust state could mutate it]** → Import only the existing reader/mode seams and test
  byte-identical state plus no writer calls.
- **[Schema-1 staging regresses]** → Pin normalized config, environment, child order, control JSON,
  formatted status, and readiness in backward-compatibility tests; deploy the feature candidate
  using the unchanged schema-1 file.
- **[Peer accidentally inherits a browser front door]** → Peer config rejects all public/auth/listen
  tables, child composition contains no Gateway, Collie remains loopback, and no transport is
  started.
- **[Downstream starts duplicating Pack]** → No Pack wire or UI path changes; tests and scope audit
  reject trust mutations, routes, transport, remote calls, and credential delegation.

## Migration Plan

1. Add schema-2 parsing and read-only native authority validation with focused tests.
2. Make Collie environment, child composition, readiness, protocol/status, and cleanup role-aware
   while pinning schema-1 behavior.
3. Update generic public docs, `FORK.toml`, Changelog, and all planning artifacts.
4. Run focused checks during implementation, then the prescribed one-time full pinned-Bun gates.
5. Push the exact candidate and deploy it only to existing isolated Lead staging with the unchanged
   schema-1 file; verify readiness and non-mutation.
6. Roll back by redeploying the previous exact commit. Schema 1 requires no file migration, and no
   Pack or transport state is created by this change.
