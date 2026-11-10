## Context

The exact upstream remains Collie v1.28.0. Readiness is Fleet-owned: the daemon currently waits ten seconds and the control caller waits twelve. Core initialization can include cold filesystem reads before its listener opens.

## Decisions

Use one owned startup-policy module. Core readiness is bounded at 60 seconds, its caller at 75 seconds and stale-lock recovery no earlier than 78 seconds; the existing TUI 10/12/15-second policy remains. Use the same selected policy at initial start, readiness recovery and competing-launch checks. Do not add a configuration field, a fixed sleep, a transport fallback or a new service.

Exercise a synthetic child that binds after thirteen seconds, plus immediate readiness, deadline failure and competing-launch budget relationships. All runtime identity, trust, process ownership and shutdown behavior stay with the existing lifecycle code.

## Simplification and boundary

No upstream file changes and no compatibility shim. A shared policy replaces independent readiness literals. Existing launch and cleanup protocols remain authoritative. The implementation changes peer code, so the product release axis is minor: 4.0.0 to 4.1.0, with a new annotated tag and the original tag unchanged.

## Delivery

Validate focused delayed-child behavior, full Fleet coverage, typechecks, lint, boundary/privacy and release gates. Build and publish the exact minor release, then accept the selected Core deployment under the separate operator workflow. Sync/archive only this change after acceptance; preserve every unrelated active change.
