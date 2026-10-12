## MODIFIED Requirements

### Requirement: Agent queue matches native attention order
The panel queue SHALL use the native Agent rail grouping, pinned-first order, section counts, per-section time order and displayed ages. Adding drag actions SHALL preserve ordinary card taps. Repeated merged snapshots SHALL NOT repeat the same Agent placement or inflate group counts. Each widened member response SHALL contribute only that member’s rows. Distinct hosts and sessions SHALL remain distinct even when names or pane addresses coincide.

#### Scenario: Same Agents appear in the rail and panel
- **WHEN** both surfaces have the same inventory and native pins
- **THEN** their headings, Agent order and displayed time semantics agree

#### Scenario: Member widening returns the merged cluster
- **WHEN** each member-scoped request includes rows for other members as well
- **THEN** each actual Agent placement appears once, group counts reflect unique rows, and native timestamp ordering applies to those rows

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
