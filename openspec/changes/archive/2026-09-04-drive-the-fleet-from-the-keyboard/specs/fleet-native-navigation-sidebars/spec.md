## ADDED Requirements

### Requirement: Both rails collapse and restore together on one command
At widths where the two rails stand, Fleet SHALL offer a command that collapses both the hierarchy
rail and the Agent rail together and restores them together, with the route column taking and giving
back the released width.

The transition SHALL animate bounded width and opacity rather than removing the rails outright, and
SHALL honour a request for reduced motion by reaching the identical final layout with no animation.

Collapsing SHALL preserve each rail's content, scroll position and disclosure state, and SHALL restore
each rail's preferred width on the way back. While collapsed, the rails and their separators SHALL be
inert and hidden from assistive technology. The command SHALL make no snapshot request and SHALL cause
no remote Pane resize. At widths where the pair of rails does not exist, the command SHALL be
unavailable.

#### Scenario: The rails are collapsed
- **WHEN** the command runs at a width where both rails stand
- **THEN** both rails and their separators transition to an inert, hidden state and the route column expands into the released width

#### Scenario: The rails are restored
- **WHEN** the command runs again
- **THEN** each rail returns to its preferred width with its content, scroll position and disclosure state as they were

#### Scenario: Reduced motion is requested
- **WHEN** the browser requests reduced motion
- **THEN** the rails reach the same final visible and inert state without a width or opacity animation

#### Scenario: The command is invoked on a narrow layout
- **WHEN** the command runs where the persistent pair of rails does not exist
- **THEN** nothing changes and Fleet reports one bounded unavailable result
