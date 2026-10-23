## ADDED Requirements

### Requirement: A hierarchy row marks a pinned Pane
A hierarchy row that stands for a Pane pinned in the adopted Collie's own per-device pin store — the
same pin the Agent rail's star reads and writes — SHALL draw its title in bold and SHALL draw a small
badge reading "pinned" immediately after the title, using the existing badge primitive. A row that
stands in for an elided single-Pane Tab SHALL carry the same mark when its one Pane is pinned. A row
standing for an unpinned Pane, and every Host, Space and multi-Pane Tab group row, SHALL be drawn
unchanged.

The pin state SHALL be derived in the browser from Collie's pin store and passed to the hierarchy
as presentation data. It MUST NOT be added to the snapshot, the Gateway, the Collie bridge or any
API, and the hierarchy MUST NOT keep a pin store of its own. A pin or unpin from any entry point
SHALL update the mark without a reload or a new snapshot.

The badge MUST NOT push the row's trailing state dot or controls off the row and MUST NOT change the
row's height; when the row is too narrow, the title SHALL truncate before the badge is dropped.

#### Scenario: A pinned Pane is listed
- **WHEN** the hierarchy lists a Pane row whose Pane is pinned
- **THEN** its title is bold and a "pinned" badge follows it, ahead of the trailing state dot

#### Scenario: A merged row's Pane is pinned
- **WHEN** a Tab holding exactly one Pane is drawn as one merged row and that Pane is pinned
- **THEN** the merged row's title is bold and carries the "pinned" badge

#### Scenario: An unpinned Pane is listed
- **WHEN** the hierarchy lists a Pane row whose Pane is not pinned
- **THEN** its title has its ordinary weight and no badge is drawn

#### Scenario: The operator pins or unpins a Pane elsewhere
- **WHEN** the operator toggles a Pane's pin from the Agent rail's star or a row menu
- **THEN** the hierarchy row's mark appears or disappears at once, without a reload or a request

#### Scenario: A pinned row's title is long
- **WHEN** a pinned row's title does not fit the rail's width
- **THEN** the title truncates, and the badge and the trailing state dot stay whole on the row
