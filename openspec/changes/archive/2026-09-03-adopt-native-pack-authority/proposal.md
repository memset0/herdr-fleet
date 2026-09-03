## Why

The exact Collie v1.2.0 baseline already implements the native Pack trust store, pinned mTLS,
signatures, router, loaders, and Pack UI, but the downstream Fleet runtime remains schema-1
lead-only and always starts a public-authentication Gateway. Establish the role-aware authority and
lifecycle foundation needed to run that native Pack safely without creating a second trust store or
prematurely implementing transport.

## What Changes

- Add a Fleet Pack authority contract that keeps Browser → Lead sessions separate from native
  Lead ↔ Peer Pack authorization. Fleet never delegates its cookie, password, or session secret to
  Pack and never creates or modifies Collie's Pack trust state.
- Treat Collie's valid native Pack trust store as the canonical membership and identity authority,
  retaining pinned mTLS, Pack secret/signature admission, strict no-grace rotation, lead-wide member
  access, and ordinary peer sibling isolation exactly where Collie already owns them.
- Add a strict backward-compatible schema 2 for `fleet.toml` with explicit `lead` or `peer` role and
  native-Pack lifecycle selection. Schema 1 lead configuration remains accepted unchanged.
- Start local Collie plus authenticated Gateway for a schema-2 lead, but local Collie only for a
  schema-2 peer. Both Collie listeners remain loopback; the peer exposes no Gateway, browser
  authentication surface, or public listener.
- Require the configured role to agree with a valid Collie-managed Pack trust state before a
  schema-2 native-Pack runtime starts. Configuration supplies no membership, certificate, secret,
  SSH endpoint, key, command, or alternate trust record.
- Preserve the Gateway's public denial of `/pack/v1/*`; an authenticated browser may use normal
  native Lead UI/API routes but its Fleet session never authorizes machine Pack admission.
- Add role-aware child composition and status while retaining Collie's native router, loaders, and
  Pack UI as the only Pack product surface.

Non-goals:

- Enrollment, invitation, join, remove, leave, rotation execution, or any Pack trust-store mutation.
- SSH, reverse/forward tunnels, endpoints, keys, commands, public HTTPS Pack paths, or peer contact.
- Host aggregation/navigation, remote reads or writes, software updates, deputy/failover, ttyd,
  Discord, deployment configuration, real peer rollout, or any v2 change/removal.
- Restoring the v2 iframe, outer routing shell, alternate Pack UI, or duplicate Pack protocol
  behavior.

## Capabilities

### New Capabilities

- `fleet-pack-authority`: Separation of Fleet browser authentication from native Pack authority,
  canonical trust-state selection, role agreement, and non-mutating Pack lifecycle boundaries.

### Modified Capabilities

- `fleet-runtime-configuration`: Add strict backward-compatible schema-2 lead/peer role and
  native-Pack lifecycle selection without transport or trust material.
- `fleet-plugin-runtime`: Make Herdr-owned child composition and status role-aware while preserving
  schema-1 lead behavior.

## Impact

- Changes fork-owned configuration, Collie environment, authority validation, supervisor child
  composition, status, tests, and public Fleet documentation under `fleet/**`.
- Reuses Collie's existing `bridge/pack/` trust reader and mode derivation without changing
  `PACK_PROTOCOL.md`, Pack wire behavior, native router/loaders/UI, or trust transitions.
- Updates `FORK.toml` and `CHANGELOG.md`; adds no dependency and no new upstream-owned runtime port.
