## Why

An operator can own a peer's network projections outside Fleet, but Fleet currently always launches an SSH client on the peer. Add an explicit external transport selection so such a peer can run its existing authenticated services without launching, supervising or replacing the operator's transport.

## What Changes

- Add a strict schema-2 peer `external` transport variant without SSH credentials or commands.
- Keep the existing `ssh-reverse` schema and command behavior unchanged.
- Run the ordinary Collie and optional terminal children under the same native authority validation while omitting the SSH child in external mode.
- Report the selected transport and separate local service readiness from externally owned connectivity; missing projections never cause Fleet to create a tunnel.
- Document the operator's responsibility for both directions and the native authenticated census as the end-to-end verification surface.

This changes fork-owned lifecycle/configuration on the exact Collie `v1.15.0` baseline (`ef01b0ed4d9271897413984075aa6d2060ffcf2a`). It reuses unchanged upstream crew authentication and services. It does not change crew wire, enrollment, trust, an upstream module, a platform service or the application's timing budgets.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-runtime-configuration`: strict external transport parsing for schema-2 peers.
- `fleet-pack-reachability`: ownership and local readiness for externally managed projections.
- `fleet-plugin-runtime`: omit the SSH child and report external ownership without changing native authority.

## Impact

Fork-owned configuration, runtime child selection, readiness/control reporting, focused tests and operator documentation. No new dependency, privileged operation or network orchestration. The release is assessed on the minor axis because peers execute the changed lifecycle; the exact release number remains a publication decision.
