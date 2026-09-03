## Context

See `proposal.md` and the three delta specs. The exact Collie v1.2.0 baseline owns Pack admission
end to end — pinned mutual TLS plus the Pack secret — and owns no reachability at all: `PACK_PROTOCOL.md`
§8.2 records a member's address as "whatever the operator can reach", with no discovery and no
overlay integration. A peer's Pack listener rides the same bind Collie already uses, so the endpoint
a Lead must dial is the Peer's existing `[collie]` endpoint, serving `/pack/v1/*` under TLS once the
member is enrolled. The preceding change made role and lifecycle answer to Collie's trust store and
added the read-only authority seam this change reuses.

## Goals / Non-Goals

**Goals:**

- Give a schema-2 Peer one operator-configured way to be dialed by its Lead, and one way to reach its
  Lead, over a single connection it owns.
- Keep the underlay strictly beneath Pack: no factor, no identity, no trust state.
- Make every failure attributable to a layer — link, Collie, or Pack.
- Keep concrete endpoints, accounts, ports and key material out of this repository.

**Non-Goals:**

- Enrollment, invitation, join, leave, removal, rotation, promotion, or any trust-store write.
- Contacting a real member, provisioning a key, or editing an `authorized_keys` file.
- A second link mode, a logical transport resolver, Host aggregation, remote reads or writes,
  software distribution, deputy behavior, or any browser-facing surface.

## Decisions

### 1. One Peer-originated connection carrying both directions

The Peer dials out; the Lead never dials the Peer's network. Both projections ride that one
connection: a remote forward publishes the Peer's `[collie]` endpoint at the Lead's loopback bind,
and a local forward publishes the Lead's Collie loopback at the Peer's loopback bind.

This matches how the Pack link actually flows — the Lead sweeps its members, so Pack traffic runs
opposite to the connection — while requiring only outbound reachability from the Peer. It also keeps
the Lead free of any Peer credential.

Alternatives rejected:

- Lead-originated SSH: requires the Lead to reach each Peer's network directly, which a Peer behind
  NAT, a cluster login node, or a one-way overlay cannot promise.
- Two connections, one per direction: doubles the credentials and the failure modes, and admits a
  half-established state in which one direction works and the other silently does not.
- Publishing a public Pack path instead of a tunnel: contradicts the peer-has-no-front-door rule the
  upstream baseline enforces.

### 2. The Peer's own projected endpoint is derived, never restated

`[transport]` names the Lead-side bind, the Peer-side bind, the Lead's Collie endpoint behind the
local projection, the SSH endpoint and account, the identity and `known_hosts` paths, and the retry
ceiling. It does **not** name the Peer's own Collie endpoint: that is already validated in `[collie]`,
and a second copy is a way for the two to disagree.

Alternatives rejected:

- Restating the Peer endpoint in `[transport]`: creates a second source of truth for one fact.
- Putting the member id in `[transport]`: the Peer's identity lives in Collie's trust store; a
  configuration copy is exactly the second roster this design refuses.

### 3. One link mode literal, and no dormant second mode

The schema admits exactly the one mode that has a runtime behind it and rejects every other value
with a qualified diagnostic. A second mode is added by the change that implements it.

Alternative rejected: accepting a forward-mode literal now. Nothing consumes it, so it would be an
unverified contract that reads as supported.

### 4. The link is a supervised child running the system SSH client

The link is one `ChildSpec` beside Collie, running the platform `ssh` binary with an explicit,
inherited-configuration-free argument set: no shell, no pseudo-terminal, no agent or X11 forwarding,
no multiplexing, no user configuration file, strict host-key checking against the configured pinned
`known_hosts`, identity taken only from the configured owner-only file, keepalives on, and
`ExitOnForwardFailure` set so a projection that cannot bind ends the attempt instead of leaving a
half-open link.

Alternatives rejected:

- An in-process SSH library: adds a dependency and a second implementation of host-key and forwarding
  semantics for no behavior the client does not already provide.
- `autossh`, a system service, or a login-shell watchdog: the plugin supervises its own children by
  design and assumes no operating-system service.

### 5. Link readiness is proven, not assumed

`ExitOnForwardFailure` makes a failed remote projection fatal to the attempt, so a live process
already implies the remote projection bound. The local projection is then proven directly: the Peer
opens a TCP connection to its own configured Peer-side bind. Readiness for a schema-2 Peer is its
Collie child ready **and** that probe succeeding.

The probe is a TCP connect and nothing more. It sends no request and reads no response, because the
endpoint behind it answers Pack TLS, and inferring lifecycle from an HTTP reply through a transparent
tunnel is exactly the behavior-probing the upstream contract rules out.

Alternatives rejected:

- Treating "the process is alive" as ready: the local projection can fail on the Peer side without
  ending the connection.
- Issuing a Pack request as a readiness check: turns a transport check into an authentication check
  and conflates the two layers this change exists to separate.

### 6. Recovery is bounded, Peer-owned and does not disturb Collie

The link child rides the supervisor's existing per-child bounded exponential backoff, with its
maximum interval set from the configured ceiling rather than the supervisor default. A second retry
mechanism would be one more thing to reason about for behavior the generation-owned supervisor
already provides per child. A link failure never restarts the Collie child, and the Lead never
creates or adopts a Peer's connection. Stopping the plugin ends the link child with the generation,
leaving no orphaned process and no published projection.

Alternative rejected: restarting the runtime on link loss. It would take a working local Collie down
for a network fault, which is precisely the "a peer that cannot reach its lead keeps working locally"
property the upstream baseline protects.

### 7. A Lead's reachability mapping is checked against native membership by the existing seam

Lead validation extends the read-only Pack authority module rather than adding a second trust reader:
it derives the enrolled member set from the same `TrustStore.load()` result already used for role
agreement and requires set equality with the configured mapping. Disagreement fails startup before any
child exists, and nothing is written.

Alternatives rejected:

- Letting configuration add members Collie has not enrolled: makes `fleet.toml` a second roster.
- Silently ignoring an unmapped member: leaves a member the Lead believes in and cannot dial, with no
  operator-visible cause.

## Risks / Trade-offs

- **[A restricted key or bind is misconfigured]** → `ExitOnForwardFailure` plus the local probe turn a
  partial link into a visible failure rather than a silent one-way link.
- **[A Lead-side projection port collides with another listener]** → the remote bind fails, the attempt
  ends, and status names the link layer; nothing falls back to a different port.
- **[A stale Lead-side listener outlives an ungraceful Peer exit]** → the Lead never adopts or repairs a
  projection it did not create; the next Peer connection either binds or fails visibly.
- **[Someone treats the tunnel as authentication]** → the specs state the boundary, the runtime derives
  no identity from an address, and tests pin that a live link admits nothing on its own.
- **[Key material leaks through diagnostics]** → identity and `known_hosts` are paths, never inline
  values; permissions are checked before use; status and errors name fields and states only.

## Migration Plan

1. Add the strict `[transport]` and `[[reachability]]` grammar with focused parser tests, including
   loopback-only projection binds and rejection of every trust-material and role-incompatible field.
2. Add the owned reachability module: argument construction, permission checks, the local-projection
   probe, and bounded backoff, all behind injectable seams so they are unit-testable without a network.
3. Extend Peer child composition, readiness, cleanup and status with the link layer, and extend Lead
   validation with the membership-equality check, pinning schema-1 behavior unchanged throughout.
4. Update `FORK.toml`, `CHANGELOG.md`, and the synthetic public configuration documentation.
5. Roll back by redeploying the previous exact commit: schema 1 and a schema-2 Lead without a
   reachability list are unaffected, and this change creates no Pack or transport state on its own.
