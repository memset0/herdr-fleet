## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Push transport stays bounded and authenticated
The lead SHALL authenticate shared-view streams through the existing session boundary, close expired or revoked sessions, disable response caching and proxy buffering, and bound slow-consumer queues. A failed stream SHALL reconnect with the current snapshot. Stream delivery SHALL NOT echo choices or change participation.

#### Scenario: A stream disconnects or its session is revoked
- **WHEN** the connection fails or its authenticated session becomes invalid
- **THEN** a still-authorized active viewer reconnects to current state, while an invalid session receives no further selections
