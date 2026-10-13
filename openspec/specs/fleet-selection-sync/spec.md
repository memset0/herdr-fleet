# fleet-selection-sync Specification

## Purpose

Allow explicitly participating Fleet browser pages to follow one shared pane selection without changing terminal focus or affecting independent viewers.

## Requirements

### Requirement: Selection sharing is explicit and ordered
Fleet SHALL offer an off-by-default join/leave control for one shared selection stream. Joined pages SHALL follow the most recent selection accepted by the lead. Joining SHALL read the existing choice before publishing any choice. A following navigation SHALL NOT republish the choice. Leaving SHALL preserve the page's current view and stop following and publishing. Browser clocks SHALL NOT decide ordering. Participation SHALL survive ordinary in-app route changes. A locally chosen Pane SHALL publish once before the previous central choice can navigate the viewer back. Visible viewers SHALL reconnect to server push after a background interruption. Accepted selections SHALL be pushed without waiting for Agent inventory polling or heartbeat completion. Every connection SHALL begin with the latest full snapshot; stale transport or mutation responses SHALL NOT roll back accepted state.

#### Scenario: Two joined viewers select different panes
- **WHEN** the lead accepts the second selection after the first
- **THEN** all joined viewers converge on the second pane and independent viewers remain unchanged

#### Scenario: A viewer joins or follows
- **WHEN** a viewer joins a stream that already has a selection or follows a new selection
- **THEN** it opens that choice without overwriting or echoing it


#### Scenario: Phone and desktop exchange choices
- **WHEN** both viewers have joined and either chooses another Pane through an ordinary Agent card
- **THEN** the other follows that Pane and following creates no additional selection write


#### Scenario: Inventory refresh is slow
- **WHEN** the lead accepts a new selection while an unrelated Agent refresh is pending
- **THEN** joined viewers receive the pushed selection and follow using fresh unique inventory without waiting for that refresh

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

### Requirement: Active participation uses expiring tab leases
The authenticated lead SHALL track transient tab participation through heartbeats. Only visible joined ordinary tabs SHALL renew an active lease. Leaving, hiding or closing SHALL withdraw participation when possible; missed heartbeats SHALL expire within fifteen seconds. Reordered older heartbeats SHALL NOT undo a newer withdrawal. Leases SHALL be scoped to authenticated sessions, counts SHALL exclude the requesting tab, and responses SHALL expose no participant identifiers. Presence writes SHALL enforce the existing exact-origin gate and bounded validated bodies. Restart SHALL clear presence and visible viewers SHALL register again without changing the central selection.

#### Scenario: A tab leaves or stops responding
- **WHEN** a tab leaves, becomes hidden, closes or stops sending heartbeats
- **THEN** its active lease is withdrawn or expires, and receiver counts decrease without a selection mutation

### Requirement: Push transport stays bounded and authenticated
The lead SHALL authenticate shared-view streams through the existing session boundary, close expired or revoked sessions, disable response caching and proxy buffering, and bound slow-consumer queues. A failed stream SHALL reconnect with the current snapshot. Stream delivery SHALL NOT echo choices or change participation.

#### Scenario: A stream disconnects or its session is revoked
- **WHEN** the connection fails or its authenticated session becomes invalid
- **THEN** a still-authorized active viewer reconnects to current state, while an invalid session receives no further selections
