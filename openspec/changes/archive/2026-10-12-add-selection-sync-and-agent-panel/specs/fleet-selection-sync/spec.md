## Purpose

Allow explicitly participating Fleet browser pages to follow one shared pane selection without changing terminal focus or affecting independent viewers.

## ADDED Requirements

### Requirement: Selection sharing is explicit and ordered
Fleet SHALL offer an off-by-default join/leave control for one shared selection stream. Joined pages SHALL follow the most recent selection accepted by the lead. Joining SHALL read the existing choice before publishing any choice. A following navigation SHALL NOT republish the choice. Leaving SHALL preserve the page's current view and stop following and publishing. Browser clocks SHALL NOT decide ordering.

#### Scenario: Two joined viewers select different panes
- **WHEN** the lead accepts the second selection after the first
- **THEN** all joined viewers converge on the second pane and independent viewers remain unchanged

#### Scenario: A viewer joins or follows
- **WHEN** a viewer joins a stream that already has a selection or follows a new selection
- **THEN** it opens that choice without overwriting or echoing it

### Requirement: Selection resolves stable identity safely
Selections SHALL use the Fleet scoped terminal reference and resolve only against fresh unique inventory. Missing or offline targets SHALL show an unavailable state and SHALL NOT select a replacement at the same pane address. Reconnection SHALL read current state before publishing local navigation. Synchronization SHALL NOT invoke terminal focus, input, resize, or attachment actions.

#### Scenario: Selected terminal moves or disappears
- **WHEN** a selected terminal moves layout or its member goes offline
- **THEN** a fresh unique original terminal is followed at its current route, or the current view remains with an unavailable indication

### Requirement: Shared state uses the existing authenticated lead boundary
Reads and writes SHALL require Fleet session authorization, mutations SHALL require the existing exact-origin gate, bodies SHALL be bounded and validated, and responses SHALL be no-store. Peers SHALL receive no new protocol or configuration requirement.

#### Scenario: A request lacks session or carries a foreign origin
- **WHEN** an unauthenticated read or cross-origin write targets shared view state
- **THEN** it is refused before state mutation or upstream access
