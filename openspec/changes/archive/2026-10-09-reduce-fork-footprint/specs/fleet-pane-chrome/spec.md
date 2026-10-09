## MODIFIED Requirements

### Requirement: The Pane route declines the shared mark
The application header SHALL let a route decline the Collie mark without taking the whole row, and
the Pane route SHALL decline it while it stands inside the Fleet navigation shell. Every other route
SHALL keep it, and so SHALL the Pane route in a bundle that mounts no shell. Declining the mark MUST NOT change
the row's height, its safe-area handling, its prerelease strip, its rule, or any other route's
header.

Declining the mark MUST NOT decline what the adopted Collie draws on it. While the connection to the
bridge is lost, Collie marks that state with a badge on its mark, so that it stays visible after the
operator has dismissed the connection strip; on the Pane route, where no mark is drawn, the same
badge SHALL be drawn in the header row's leading position, with the same icon and the same
accessible wording, and SHALL leave when the connection returns.

#### Scenario: Operator opens a Pane
- **WHEN** the Pane route owns the header row
- **THEN** no Collie mark is drawn and the row's height and rule are unchanged

#### Scenario: Operator returns to a route that keeps the mark
- **WHEN** the operator navigates from a Pane to the dashboard
- **THEN** the mark is drawn again without remounting the header

#### Scenario: The connection is lost while a Pane is open
- **WHEN** the bridge stops answering while the Pane route owns the header and the operator dismisses the connection strip
- **THEN** the connection badge is still visible in the header row, and it leaves when the bridge answers again

#### Scenario: A Pane is opened in a bundle with no shell
- **WHEN** a bundle built without the Fleet statement renders the Pane route
- **THEN** the Collie mark is drawn on its header as upstream draws it

