## ADDED Requirements

### Requirement: The phone's hierarchy is the rail arriving from the edge
The hierarchy surface presented below the wide-layout threshold SHALL wear the wide-layout rail's
own ground and its own title treatment, and SHALL present the same rows. It MAY add only what a
drawer needs and a rail does not — a control that dismisses it — and MUST NOT introduce a second
visual treatment of the same surface.

#### Scenario: Operator opens the hierarchy on a phone
- **WHEN** the hierarchy surface is on screen below the wide-layout threshold
- **THEN** its ground, its title and its rows are the wide-layout rail's, with a dismiss control added

### Requirement: A rail row's controls and facts sit at opposite corners
An Agent rail row SHALL place its favourite control at its top trailing corner and its age at its
bottom trailing one, so a control and a fact never compete for the same position. The favourite
control SHALL be drawn whether or not the row is a favourite, because a control that appears only on
hover is a control a touch device does not have.

#### Scenario: A row is drawn on a touch device
- **WHEN** the rail lists a row that is not a favourite
- **THEN** its favourite control is still drawn, muted, at the row's top trailing corner

#### Scenario: A row carries an age
- **WHEN** the row's section dates its rows
- **THEN** the age is drawn at the row's bottom trailing corner, beneath the favourite control
