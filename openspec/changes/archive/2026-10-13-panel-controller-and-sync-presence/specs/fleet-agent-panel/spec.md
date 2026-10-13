## MODIFIED Requirements

### Requirement: Panel taps use native selection behavior
A tap on a fresh Agent or resolved slot SHALL publish the central selection and highlight it while keeping the panel open, regardless of the controller’s participation. Normal joined pages SHALL open that Agent’s native Pane. The panel SHALL NOT require a join action or count as an active follower. Dragging and favorite assignment SHALL NOT publish a Pane selection.

#### Scenario: A controller selects an Agent without joining
- **WHEN** the operator taps a live Agent or resolved slot without joining selection sharing
- **THEN** the panel stays open, highlights the shared choice, and other joined pages follow the correct host/session Pane

#### Scenario: A joined operator selects an Agent
- **WHEN** the operator taps a live Agent after no drag was armed
- **THEN** the panel stays open, highlights the choice and other joined pages follow the correct host/session Pane

## ADDED Requirements

### Requirement: Controller reports active receivers
The panel SHALL display the number of other active joined browser tabs, excluding itself. The count SHALL describe tabs rather than unique physical devices. Unknown presence SHALL show unavailability rather than an invented zero.

#### Scenario: Two joined tabs and a controller are open
- **WHEN** two visible ordinary tabs have joined and a panel is open
- **THEN** the panel reports two receivers and publishing a selection does not enroll the panel
