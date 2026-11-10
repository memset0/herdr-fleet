## Why

Fleet currently adopts Collie v1.23.3 (`5bb4233b07cbfed2239fcfd7fe013323b55ac49c`) and drives the older Herdr TUI. Operators using Herdr App and herdr-core need the Web surface to follow those terminals, while retaining tolerance for delayed screen updates and the existing authenticated front door.

## What Changes

- Adopt exact Collie v1.28.0 (`b178eb63f2255637f6326bb942a2505e2004c31f`) through a real ancestry merge, after an explicitly approved release-line reconciliation. Its actual common ancestor with Fleet is v1.23.1 (`8c4c0d4f969da9e226933504f4ae79219916196a`), rather than the recorded adopted release; the current preflight correctly stops.
- Reuse upstream's Core adapter, screen completeness handling, late-probe recovery and post-record token minting. Review every invasive port and remove ports upstream now makes unnecessary.
- Preserve Fleet's patient send/read budgets, immediate send refusal instead of deferred holding, authentication, pairing, terminal exclusivity and machine-local resolution.
- Add a Core runtime path that needs no TUI process or plugin invocation, with explicit Core session/socket selection and matching local terminal attachment, manual fit and scoped durable associations.
- Remove the Todoist integration from Fleet: OAuth, API, UI, task delivery and its dedicated dependencies. Preserve existing external tasks and live operator data for a future independent design.
- **BREAKING**: migrating an existing deployment changes its backend selection and lifecycle invocation. This is a product major migration; the owner has explicitly authorized publication as 4.0.0 after verified implementation.
- Review removal of obsolete TUI-specific Fleet paths and operational dependencies; retain upstream's independent TUI adapter unchanged. Do not remove live TUI sessions as a migration side effect.

## Capabilities

### New Capabilities

- `fleet-core-runtime`: Core-backed standalone execution, exact terminal resolution, attachment, fit, identity and explicit deployment transition.

### Modified Capabilities

- `fleet-upstream-sync`: an explicitly audited adoption across divergent upstream release lines, retaining both adopted provenance and the actual common ancestor.
- `fleet-send-patience`: retain slow-response tolerance while replacing equivalent downstream work with upstream fixes and accounting for all request phases.
- `fleet-terminal-bindings`: retain shared favorites/tags while retiring Todoist as a consumer.
- `fleet-todoist`: retire all product-owned Todoist integration behavior.
- `fleet-plugin-runtime`: allow Core-backed execution without a TUI-owned lifecycle, preserving the role-specific child and trust boundaries.

## Impact

Product source: fork preflight and its tests, runtime/configuration/entrypoints, Core terminal integration, bindings, send ports, fork inventory and public migration guidance. Existing authentication and crew trust remain authoritative; an upstream merge is not an enrolment or network-topology change.

Non-goals: implementing upstream features a second time; changing agent trust automatically; reinstalling desktop Apps; terminating existing terminal processes; operating other machines implicitly; publishing without the owner’s explicit 4.0.0 authorization. Deployment facts and receiving-machine operations remain outside the public tree. Other active changes remain owned by their existing authors.
