## Why

Herdr Fleet's lifecycle is the Herdr plugin's: it supervises its own children under one
generation-owned supervisor and installs no operating-system service, because a peer runs rootless on
hosts that have no service manager at all. Collie's own `cli/**` does not share that assumption. Its
membership verbs resolve an upstream plugin identity from a constant and pick a host supervision tier,
so running one against a Fleet deployment writes another plugin's configuration directory, registers a
service unit, and restarts something Fleet does not own.

The transitions underneath that CLI have no such assumption: `bridge/pack/enrollment.ts` is pure
functions over trust-store data, and `TrustStore.update()` is their single persistence seam. Fleet
already consumes the read half of that seam for role agreement. Consume the write half the same way,
and the membership change Fleet needs stops requiring a service manager it may not have.

## What Changes

- Add a Fleet-owned enrolment module that performs membership changes by applying Collie's existing
  pure Pack transitions through `TrustStore.update()`, reusing Collie's own wire shapes for the
  exchange. It calls no Collie CLI verb and resolves no plugin identity or supervision tier.
- Add two explicit operator commands to the existing Fleet entrypoint: one mints a single-use invite
  on a lead, one spends an invite on a peer through that peer's own loopback projection of the lead.
  Neither controls a process; each names the plugin action that applies the change to a running
  runtime.
- State the boundary the incident exposed: Fleet MUST NOT install, enable, restart or otherwise
  depend on an operating-system service, on any host, for any purpose.
- Narrow the existing prohibition so it says what it means: the Fleet *runtime* still never mutates
  Pack trust state, while an explicit operator-invoked enrolment may, through Collie's own transitions
  and never through a second implementation of them.

Non-goals:

- Rotation, removal, leaving, promotion, deputy, and every other membership verb beyond the first
  enrolment of a peer.
- Contacting a real member, deploying, or performing an actual enrolment.
- A second trust store, a second Pack wire format, a re-implementation of any transition, or any
  change to `bridge/**`, `PACK_PROTOCOL.md`, the native router, loaders or Pack UI.
- Process supervision, service units, and any change to how children are started or stopped.

## Capabilities

### New Capabilities

- `fleet-pack-enrollment`: Fleet-owned orchestration of the first peer enrolment through Collie's own
  transitions, its explicit operator commands, and the service-manager-free lifecycle boundary.

### Modified Capabilities

- `fleet-pack-authority`: Narrow the trust-state prohibition to the runtime, so an explicit
  operator-invoked enrolment is permitted through Collie's own transitions.

## Impact

- Adds one owned module, its tests, and two subcommands on the existing Fleet entrypoint under
  `fleet/**`, plus `FORK.toml`, `CHANGELOG.md` and the public documentation.
- Reuses `bridge/pack/enrollment.ts` and `bridge/pack/trust-store.ts` from a fork-owned module exactly
  as the authority module already does, so it adds no invasive path and no dependency.
