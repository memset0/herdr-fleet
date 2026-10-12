## Why

Browsers currently select panes independently. Operators need an opt-in shared selection and a touch-friendly, fixed-position Agent control panel spanning all members.

## What Changes

- Add one optional shared selection stream: the last selection accepted by the lead wins, joining follows the existing selection, and passive following never publishes another selection.
- Add a fullscreen `/panel` route with square slots, an all-member/all-session Agent queue, touch drag-to-replace favorites, live status-transition feedback, and a bottom exit button returning to `/`. Portrait places the queue below the grid; landscape places it on the right. Grid row/column controls live at the queue's bottom and never remove its reserved space. A normal URL always opens the normal interface.
- Persist the panel's unified slot layout on the lead and share it with authenticated viewers. These positional favorites are separate from unchanged browser-local native stars.
- Reuse Collie v1.19.0 snapshots, Agent status, native pane navigation, and Fleet terminal references. Keep the new state and interactions in fork-owned modules.
- Non-goals: terminal focus or input broadcasting, terminal resizing, changing native pins, new member protocols, services, enrollment, or credentials.

## Capabilities

### New Capabilities
- `fleet-selection-sync`: opt-in browser selection with authoritative ordering and no feedback loops.
- `fleet-agent-panel`: fullscreen touch grid, cross-member queue, durable shared positions, and ordinary-route exit.

### Modified Capabilities
- `fleet-agent-favorites`: explicitly scope existing browser-local favorite requirements to native pin entrypoints; positional panel favorites have their own capability.
- `fleet-terminal-bindings`: name native favorite storage locality precisely so the new panel consumer can share identity without changing native pins.

## Impact

Fork-owned Gateway state/routes and web components; narrow router and navigation ancestry ports recorded in FORK.toml. No new dependency or peer-executed behavior. Gateway changes require restarting the lead Fleet plugin; terminals and Herdr servers are outside this operation. Verification covers ordering, authorization, persistence, identity, drag cancellation, mobile geometry, route recovery, and fork/public-tree checks.
