## Context

See proposal.md. The exact Collie baseline remains v1.15.0. Configuration and supervision are already fork-owned. Native role validation is independent of the SSH fields. Existing operators must retain the current schema and lifecycle unchanged.

## Goals / Non-Goals

**Goals:** A peer can serve through operator-owned projections without running SSH; the configuration and status name that ownership explicitly.

**Non-Goals:** No network orchestrator, platform service, changed crew protocol, trust mutation, timeout adjustment, shell shim or alternate bridge supervisor.

## Decisions

- Keep the existing SSH transport type as its own strict variant and add an external variant containing only the distinct loopback peer-side Lead projection. An omitted table does not infer external mode.
- Keep the terminal table compatible. Its existing Lead-side endpoint remains a declared descriptor; external mode never publishes it. SSH-only cross-endpoint checks remain on the SSH variant; local collision checks apply to both.
- Child selection omits link entirely for external peers. Both controller and daemon skip SSH-file preflight only for that explicit variant. Collie, native authority and optional terminal child stay unchanged.
- External readiness observes local owned children/Collie only. It does not poll or infer the operator's network health. The control protocol has an optional external marker; existing SSH and schema-1 output remain byte-identical. The authenticated lead census remains end-to-end evidence.
- Every code edit stays in the existing fleet-runtime owned root. No upstream port or wire change is needed.
- The concurrent documentation author completed its release before integration. Append the exact operator/changelog drafts to the latest clean files, preserving that release and unrelated content.

## Risks / Trade-offs

- [Local readiness could be mistaken for connectivity] → explicit external marker and docs; never synthesize a link child or connectivity success.
- [Selecting external with an older release] → old releases reject it; install a supporting stable release before changing the operator's configuration.
- [External projection absent during startup] → local services remain alive, and restoration requires no restart.

## Migration Plan

Existing SSH configurations require no edits. A selected operator stages external projections, preserves prior release/configuration and changes only the peer transport variant during a Fleet-only restart. Rollback restores its previous release and transport configuration after releasing competing projections. Native trust and multiplexer processes never change.

Source verification completes the product change; deployment acceptance is tracked independently. The code warrants a minor release on the repository's deployment-reach axis; its exact number is chosen from the freshest remote tag. The selected minor release follows the product working agreement and the existing rollout scope is reviewed separately.
