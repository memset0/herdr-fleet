## Purpose

Provide a touch-friendly fullscreen control panel combining stable square favorites and a queue of Agents across all Fleet members and sessions.

## ADDED Requirements

### Requirement: The panel is a separate fullscreen route
The `/panel` route SHALL use the available viewport without normal header or sidebars. It SHALL contain square fixed-position slots and a scrollable queue of all Agents across all members and sessions. Portrait SHALL place the queue below the grid; landscape SHALL place it to the right. The queue SHALL retain a usable portion of the viewport regardless of grid dimensions. Row/column controls and an exit button returning to the normal root route SHALL live at the queue's end. Resize SHALL preserve occupied assignments or refuse with a visible explanation. Ordinary application URLs SHALL always render their ordinary interface, including after reload. The left navigation footer SHALL offer a small panel entry on the build-version row below the unchanged Collie/TTYD switch.

#### Scenario: Operator enters and exits the panel
- **WHEN** the operator opens `/panel`, scrolls to the queue's end and exits, or directly loads `/`
- **THEN** the panel fills the viewport at its route and the ordinary interface returns at the ordinary route

#### Scenario: Operator uses the compact sidebar entry
- **WHEN** the operator activates the small grid icon beside the build version
- **THEN** Fleet opens `/panel` and the surface switch retains its separate row

### Requirement: Dragging assigns and replaces positional favorites
An operator SHALL be able to drag an Agent from the queue to any square slot, using a touch hold gesture or a pointer. Dropping SHALL replace that slot's previous favorite without deleting either Agent from the queue. Slots SHALL retain positions independently of status changes. A keyboard-accessible select-then-slot alternative SHALL provide the same assignment. Scrolling or cancelling a gesture SHALL NOT assign a slot or open a pane.

#### Scenario: Occupied slot receives another Agent
- **WHEN** an Agent is dropped onto an occupied slot
- **THEN** that slot records the new Agent, the displaced Agent remains in the all-Agent queue, and other slots keep their positions

#### Scenario: Touch scroll is not a drag
- **WHEN** the operator moves before a hold is armed or cancels a drag
- **THEN** no favorite changes and no pane navigation occurs

### Requirement: Panel slots share durable terminal references
One lead-persisted slot layout SHALL span all members and authenticated browsers. Slot identity SHALL follow stable terminal references rather than names or layout positions. Offline, missing or ambiguous entries SHALL retain their slot and show unavailability without inheriting a replacement terminal. Concurrent writes SHALL NOT silently discard an unrelated slot update. Native browser-local stars SHALL retain their existing semantics.

#### Scenario: Another viewer opens the panel after a restart
- **WHEN** a saved slot layout exists
- **THEN** the same assignments appear in their original positions and live unique Agents show their current status

### Requirement: Panel taps use native selection behavior
A tap on a fresh Agent or resolved slot SHALL select that Agent. When the panel is joined to selection sharing, it SHALL publish the central choice and highlight it while keeping the panel open; normal joined pages SHALL open that Agent's native Pane. An independent panel SHALL use native Pane navigation. Dragging and favorite assignment SHALL NOT publish a Pane selection.

#### Scenario: A joined operator selects an Agent
- **WHEN** the operator taps a live Agent after no drag was armed
- **THEN** the panel stays open, highlights the choice and other joined pages follow the correct host/session Pane

### Requirement: Slot transitions provide visible status feedback
Fresh status transitions SHALL produce bounded, clearly visible feedback on the corresponding square. Completion SHALL show a green check. Initial load, assignment and stale observations SHALL NOT fabricate completion events. Reduced-motion mode SHALL retain the check and status without nonessential movement.

#### Scenario: A working Agent finishes
- **WHEN** a live slotted Agent transitions from working to done
- **THEN** its square shows a green completion check and finite animation, or a static check with reduced motion, without moving the grid
