## Why

The touch panel duplicates a flat Agent queue, so it disagrees with the sidebar's grouped time order. Its handle-only drag lacks a visible carried card and ordinary card gestures need real mobile validation.

## What Changes

- Reuse the existing native Agent rail for panel classification, pin grouping, headings, per-section time order, and cards, with narrow owned ports for drag actions and availability.
- Keep ordinary card taps as Pane selection; support touch hold/drag from the card and handle without mistaking scrolling or dragging for a tap, and show visible drag feedback.
- Size the portrait grid to its natural content height and give all remaining viewport space to the Agent list, with a minimum usable list area when a large grid must scroll. Keep landscape grid-left/list-right with a bounded grid width.
- Correct and verify joined ordinary-route publication and bidirectional phone/desktop following without echoes.
- Reuse Collie v1.19.0 data and Fleet roster semantics. Non-goals: backend or peer changes, pin/slot storage changes, terminal input/focus, or new dependencies.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `fleet-agent-panel`: sidebar-identical grouping and order, card taps and mobile drag, and content-sized layout.

- `fleet-selection-sync`: root-shell route publication, fresh-state following, and multi-viewer reconnection verification.

## Impact

Owned panel, native rail/card interaction ports, CSS and focused unit/browser tests. No upstream production port or runtime protocol changes. This warrants a lead-only patch release after verification.
