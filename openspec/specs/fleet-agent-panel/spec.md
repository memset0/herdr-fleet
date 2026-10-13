# fleet-agent-panel Specification

## Purpose

Provide a touch-friendly fullscreen control panel combining stable square favorites and a queue of Agents across all Fleet members and sessions.

## Requirements

### Requirement: The panel is a separate fullscreen route
The `/panel` route SHALL use the available viewport without normal header or sidebars. It SHALL contain square fixed-position slots and a scrollable queue of all Agents across all members and sessions. Portrait SHALL place the queue below the grid; landscape SHALL place it to the right. Portrait grid height SHALL follow its square content up to the space needed to retain a usable queue, and all remaining space SHALL belong to the queue. The queue SHALL retain a usable portion of the viewport regardless of grid dimensions. Row/column controls and an exit button returning to the normal root route SHALL live at the queue's end. Resize SHALL preserve occupied assignments or refuse with a visible explanation. Ordinary application URLs SHALL always render their ordinary interface, including after reload. The left navigation footer SHALL offer a small panel entry on the build-version row below the unchanged Collie/TTYD switch.

#### Scenario: Operator enters and exits the panel
- **WHEN** the operator opens `/panel`, scrolls to the queue's end and exits, or directly loads `/`
- **THEN** the panel fills the viewport at its route and the ordinary interface returns at the ordinary route

#### Scenario: Operator uses the compact sidebar entry
- **WHEN** the operator activates the small grid icon beside the build version
- **THEN** Fleet opens `/panel` and the surface switch retains its separate row

### Requirement: Dragging assigns and replaces positional favorites
An operator SHALL be able to drag an Agent from the queue to any square slot, using touch or a pointer from its six-dot assignment handle. The handle SHALL begin dragging immediately without a hold delay and SHALL NOT scroll the queue. The card body SHALL retain ordinary taps and native scrolling without starting a drag. An armed drag SHALL show a visible carried card and target feedback. Dropping SHALL replace that slot's previous favorite without deleting either Agent from the queue. Slots SHALL retain positions independently of status changes. A keyboard-accessible select-then-slot alternative SHALL provide the same assignment. Scrolling or cancelling a gesture SHALL NOT assign a slot or open a pane.

#### Scenario: Occupied slot receives another Agent
- **WHEN** an Agent is dropped onto an occupied slot
- **THEN** that slot records the new Agent, the displaced Agent remains in the all-Agent queue, and other slots keep their positions

#### Scenario: Touch scroll is not a drag
- **WHEN** the operator scrolls from the card body or cancels a drag
- **THEN** no favorite changes and no pane navigation occurs

#### Scenario: Immediate handle drag
- **WHEN** the operator presses and moves the six-dot handle toward a slot without waiting
- **THEN** the Agent follows the pointer, the slot accepts the drop, and native queue scrolling does not steal the gesture

### Requirement: Panel slots share durable terminal references
One lead-persisted slot layout SHALL span all members and authenticated browsers. Slot identity SHALL follow stable terminal references rather than names or layout positions. Offline, missing or ambiguous entries SHALL retain their slot and show unavailability without inheriting a replacement terminal. Concurrent writes SHALL NOT silently discard an unrelated slot update. Native browser-local stars SHALL retain their existing semantics.

#### Scenario: Another viewer opens the panel after a restart
- **WHEN** a saved slot layout exists
- **THEN** the same assignments appear in their original positions and live unique Agents show their current status

### Requirement: Panel taps use native selection behavior
A tap on a fresh Agent or resolved slot SHALL publish the central selection and highlight it while keeping the panel open, regardless of the controller’s participation. Normal joined pages SHALL open that Agent’s native Pane. The panel SHALL NOT require a join action or count as an active follower. Dragging and favorite assignment SHALL NOT publish a Pane selection.

#### Scenario: A controller selects an Agent without joining
- **WHEN** the operator taps a live Agent or resolved slot without joining selection sharing
- **THEN** the panel stays open, highlights the shared choice, and other joined pages follow the correct host/session Pane

#### Scenario: A joined operator selects an Agent
- **WHEN** the operator taps a live Agent after no drag was armed
- **THEN** the panel stays open, highlights the choice and other joined pages follow the correct host/session Pane

### Requirement: Slot transitions provide visible status feedback
Fresh status transitions SHALL produce bounded, clearly visible feedback on the corresponding square. Completion SHALL show a green check. Initial load, assignment and stale observations SHALL NOT fabricate completion events. Reduced-motion mode SHALL retain the check and status without nonessential movement.

#### Scenario: A working Agent finishes
- **WHEN** a live slotted Agent transitions from working to done
- **THEN** its square shows a green completion check and finite animation, or a static check with reduced motion, without moving the grid

### Requirement: Agent queue matches native attention order
The panel queue SHALL use the native Agent rail grouping, pinned-first order, section counts, per-section time order and displayed ages. Adding drag actions SHALL preserve ordinary card taps. Repeated merged snapshots SHALL NOT repeat the same Agent placement or inflate group counts. Each widened member response SHALL contribute only that member’s rows. Distinct hosts and sessions SHALL remain distinct even when names or pane addresses coincide.

#### Scenario: Same Agents appear in the rail and panel
- **WHEN** both surfaces have the same inventory and native pins
- **THEN** their headings, Agent order and displayed time semantics agree

#### Scenario: Member widening returns the merged cluster
- **WHEN** each member-scoped request includes rows for other members as well
- **THEN** each actual Agent placement appears once, group counts reflect unique rows, and native timestamp ordering applies to those rows

### Requirement: Controller reports active receivers
The panel SHALL display the number of other active joined browser tabs, excluding itself. The count SHALL describe tabs rather than unique physical devices. Unknown presence SHALL show unavailability rather than an invented zero.

#### Scenario: Two joined tabs and a controller are open
- **WHEN** two visible ordinary tabs have joined and a panel is open
- **THEN** the panel reports two receivers and publishing a selection does not enroll the panel
