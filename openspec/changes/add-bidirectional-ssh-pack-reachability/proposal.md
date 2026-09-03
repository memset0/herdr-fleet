## Why

The exact Collie v1.2.0 baseline authenticates a Pack link with pinned mTLS plus the Pack secret and
deliberately owns no reachability: `PACK_PROTOCOL.md` §8.2 states that a member's address is
"whatever the operator can reach", with no discovery and no overlay integration, ever. The preceding
Fleet change made role and lifecycle selection answer to Collie's native Pack trust store, but a
schema-2 Peer still has no way for its Lead to dial it, and no way to reach its Lead. Supply that
missing transport as a generic, operator-configured SSH underlay, without inventing a second trust
plane and without contacting a real member.

## What Changes

- Add a Fleet-owned reachability contract: exactly one Peer-originated SSH connection carries both
  loopback directions for a Pack member, and reachability is never an identity assertion. Pinned
  mTLS and the Pack secret remain the only things that authenticate a member, unchanged and above
  this layer.
- Add a strict schema-2 `[transport]` table for a Peer that names one `ssh-reverse` link: the Lead's
  SSH endpoint and account, the Lead-side loopback bind the Lead will dial, the Peer-side loopback
  bind that projects the Lead's Collie, and owner-only paths to an SSH identity and a pinned
  `known_hosts`. It carries no member id, certificate, fingerprint, Pack secret, password, or
  roster row.
- Add a strict schema-2 `[[reachability]]` list for a Lead: member id to loopback endpoint only. It
  is a projection of membership, never a source of it.
- Supervise the SSH link as one Peer-owned child beside Collie, with `ExitOnForwardFailure`, no
  shell, PTY, agent forwarding, X11 forwarding, connection multiplexing or unrelated forwarding, and
  bounded exponential backoff with a cap. A forward that cannot be established fails visibly instead
  of leaving a silent half-open link.
- Make Peer readiness and status report the link as its own layer, so "the tunnel is down" and "Pack
  authentication failed" are never conflated.
- Make a Lead validate at startup that the configured reachability member set is exactly the enrolled
  member set Collie's Pack trust store already reports, through the existing read-only authority
  seam. A disagreement fails closed and mutates nothing.

Non-goals:

- Enrollment, invitation, join, leave, removal, rotation, promotion, or any Pack trust-store write.
- Contacting a real member, provisioning an SSH key, editing an `authorized_keys` file, or any
  device, cluster, address, port, account, or overlay-network fact.
- A public HTTPS Pack path, a Pack wire change, a second roster, a logical transport resolver, or a
  downstream Pack protocol.
- Host aggregation, remote reads or writes, software distribution, deputy or failover behavior, ttyd,
  and every browser-facing surface.
- `ssh-forward` mode: the schema names one mode and admits only it, so an unbuilt second mode cannot
  become a dormant contract.

## Capabilities

### New Capabilities

- `fleet-pack-reachability`: The SSH underlay beneath native Pack — its single Peer-originated
  connection, its two loopback projections, ownership and restriction of the link, bounded recovery,
  layered failure reporting, and the boundary that keeps reachability from ever becoming identity.

### Modified Capabilities

- `fleet-runtime-configuration`: Add the strict schema-2 Peer `[transport]` table and Lead
  `[[reachability]]` list, with exact-key validation and no trust material.
- `fleet-plugin-runtime`: Make Peer child composition, readiness, cleanup and status include the
  supervised SSH link alongside Collie.

## Impact

- Changes fork-owned configuration parsing, child composition, readiness, status, the new
  reachability module and its tests under `fleet/**`, plus `FORK.toml`, `CHANGELOG.md` and the
  synthetic public configuration documentation.
- Reuses Collie's existing Pack trust reader through the authority module added by the preceding
  change; adds no dependency, no upstream-owned runtime port, and no change to `PACK_PROTOCOL.md`,
  `bridge/pack/**`, the native router, loaders, or Pack UI.
- Concrete endpoints, accounts, ports, key material and per-device files stay entirely outside this
  repository; the public tree carries only the generic schema, validation, runtime contract and
  synthetic examples.
