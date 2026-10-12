## Context

See proposal.md. The baseline is Collie v1.19.0. The panel already shares durable slot state but duplicates the native Agent rail and uses fixed viewport fractions. The persistent root shell observes navigation and polls a shared selection independently from route loaders.

## Goals / Non-Goals

Preserve native grouping and card semantics through optional ports in owned components. Keep gestures local to the panel. No backend, peer, terminal-control, dependency or stored-state migration.

## Decisions

- Reuse NativeAgentRail with optional row actions, availability and interaction props. This keeps roster grouping and timestamp order authoritative; copying the roster would create another implementation to maintain.
- Arm touch dragging after a hold with jitter tolerance; prevent native scrolling only for the assignment handle or after an armed card gesture. Carry visible feedback, suppress post-drag clicks and clean cancelled gestures. Retain keyboard select-then-slot.
- Let portrait grid content determine height with a cap reserving list space. In landscape calculate grid width from height and dimensions, bounded to preserve the right-hand queue. Fixed equal fractions waste space with small grids.
- Resolve ordinary Pane addresses with the router’s decoded pathname match, not child-only root parameters. Read the client current busy state before following so a local publication cannot race the previous selection. Verify polling resumes after background interruptions. Do not persist participation across unrelated browser reloads.
- All production changes remain in existing owned modules. Any new owned tests are declared in FORK.toml. No upstream production port is needed.

## Risks / Trade-offs

- Native touch cancellation can interrupt dragging → real Chromium touch-event tests and an always-available assignment handle.
- Large grids exceed the viewport → scroll the grid while reserving usable queue space.
- Poll/navigation races can echo stale choices → assert bidirectional ordinary-route choices and no extra writes.

## Migration Plan

Ship a frontend-only patch on the lead. Existing peers and persisted slots remain compatible. Rebuild the previous released frontend to roll back.

## Release Assessment

This verified frontend scope is PATCH: 3.15.6 → 3.15.7. Archive after frontend verification and before the functional commit. Commit only this change on main, push normally, cut a separate four-file release commit and annotated tag, then rebuild the lead frontend and verify build metadata. No member redeployment or backend restart is needed. Preserve the prior release notes under their correct heading.

## Verification

41 focused frontend tests and 730 Fleet tests passed. Six Chromium scenarios passed, including real touch hold/drop, short taps, handle/slot assignment, native scrolling, portrait/landscape geometry and bidirectional ordinary-route synchronization with no echoes. Root and frontend typechecks, full-tree lint, fork-boundary and public-tree audits passed.
