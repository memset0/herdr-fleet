## Why

A phone panel is a controller for joined viewers, but currently requires joining or opens its own Pane. The operator cannot tell how many active joined tabs will receive a choice.

## What Changes

- Make panel Agent/slot taps publish the shared selection unconditionally while retaining the panel route and never enrolling the controller as a follower.
- Show a count of other active joined browser tabs on the panel. Visible joined ordinary pages renew an expiring lease; hidden, left and closed tabs stop contributing.
- Reuse Collie v1.20.1 navigation, the existing authenticated Gateway and native Agent inventory. Keep ordinary-page opt-in and selection ordering unchanged. No peer, terminal-control, durable presence, or unique-device tracking changes.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `fleet-agent-panel`: independent controller taps and other active-viewer count.
- `fleet-selection-sync`: authenticated, transient per-tab participation leases.

## Impact

Owned Gateway presence endpoint, ephemeral registry, browser client lifecycle and panel header, plus focused tests and locale strings. Lead-only patch; Gateway restart and frontend rebuild are required, peers remain unchanged.
