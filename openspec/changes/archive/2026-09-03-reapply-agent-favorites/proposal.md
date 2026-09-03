## Why

The exact Collie v1.2.0 baseline already provides the native Agent dashboard and triage order, but
it does not preserve the v2 Fleet ability to favorite frequently used Agents. Reapply that
user-visible capability directly in Collie's native list without restoring the retired outer Fleet
shell or iframe architecture.

## What Changes

- Add a bounded, versioned browser-local favorite store whose stable identity combines optional
  Host, Herdr session, Pane id, and Agent implementation.
- Add a Collie-styled favorite control to native Agent rows. Toggling it preserves focus and does
  not navigate, refresh, mutate a Pane, or call a backend API.
- Sort favorites before non-favorites only within each existing `Needs you`, `Ready · unseen`,
  `Working`, and `Recent` section, preserving the section's native comparator inside both
  partitions.
- Keep malformed, unsupported, oversized, unavailable, or unwritable browser storage fail-safe
  through bounded in-memory state.
- Record the owned state boundary and the minimum native Agent-list/card ports in `FORK.toml`.

Non-goals:

- Pack activation, multi-host trust, peer roles, SSH, enrollment, transport, or `fleet.toml`
  changes.
- A synchronized favorite service, server state, API, Settings control, Gateway behavior, router
  change, outer Fleet shell, iframe, or frame protocol.
- Shortcuts, command palette, Pane-link copy, manual resize, notifications, ttyd, STT, deployment
  mechanism/configuration changes, release, production cutover, or any v2 modification/removal.

## Capabilities

### New Capabilities

- `fleet-agent-favorites`: Browser-local Agent favorite identity, persistence, interaction, and
  stable favorite-first ordering inside Collie's existing triage sections.

### Modified Capabilities

None. Collie's native dashboard, triage classification, routing, polling, and Agent-card behavior
remain upstream authority outside the narrow favorite ports.

## Impact

- Adds fork-owned favorite state and ordering logic under `fleet/ui/`.
- Adds narrow adapters to the native Agent list/card and focused tests for ordering and
  interaction.
- Updates `FORK.toml` and `CHANGELOG.md`.
- Adds no dependency, network request, backend state, configuration field, route, or deployment
  change.
