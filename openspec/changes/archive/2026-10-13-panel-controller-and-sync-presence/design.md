## Context

See proposal.md. Collie v1.20.1 route navigation and Fleet shared selection are reused. Fleet’s Gateway already provides authenticated exact-origin mutation gates and a persistent browser shell.

## Goals / Non-Goals

Separate controller publication from follower participation. Count browser tabs, not devices or users. Presence is ephemeral; no peer protocol, terminal effects or stored-state migration.

## Decisions

Add a fork-owned presence registry and POST endpoint beneath the Gateway’s existing authentication/origin gates. A random page-lifetime UUID and monotonically increasing pulse sequence identify a session-scoped lease. Leases expire after 15 seconds; withdrawals retain a short tombstone so reordered older pulses cannot revive them. Bound the registry and request body, expose only the other-tab count and clear session leases on logout.

Reuse the existing 1.5-second polling lifecycle for pulse renewal. Visibility, pagehide, leave and shell cleanup withdraw with keepalive; visibility return renews. A panel queries counts with inactive pulses and publishes choices without joining. Replace the panel join control with a labelled count; normal-page join controls remain unchanged.

## Risks / Trade-offs

Browser termination can skip lifecycle events → lease expiry bounds stale counts. Counts measure active visible tabs, so hidden joined tabs retain their opt-in but are absent until resumed. Gateway restart temporarily clears presence → visible joined tabs renew on their next poll.

## Migration Plan

Lead-only patch; build and restart Fleet on the lead while preserving main and existing browser authorization. Peers need no redeployment. Verify authenticated presence and served build metadata. Roll back to the previous release if needed.

## Verification and Release Assessment

28 targeted Gateway/shared-state tests, 738 Fleet tests, 16 focused frontend tests and eight browser scenarios passed. Controller publication, two-receiver counts, explicit leave and closed-tab expiry were verified; existing touch and ordering scenarios remain passing. Root/frontend typechecks, full-tree lint, privacy and fork audits passed. Release axis is PATCH, 3.16.1 → 3.16.2: lead frontend rebuild and Gateway restart, with no member redeployment. Archive before the functional commit; then publish a separate four-file release and annotated tag on main, build and verify authenticated presence without changing the selection or existing slots.
