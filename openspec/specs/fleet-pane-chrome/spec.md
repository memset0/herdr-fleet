# fleet-pane-chrome Specification

## Purpose
Governs what the Pane screen spends its fixed rows on: where the pane's state is spelled, how its
controls are ranked, and which of the shared header's fixtures that route declines.

## Requirements

### Requirement: The pane's state is spelled once, in a row already being spent
Herdr Fleet SHALL present the pane's state as a badge carrying both a colour and the state's word,
right-aligned at the trailing end of the strip row above the mirror and immediately before that
row's fold control. The badge MUST reuse Collie's existing status presentation, MUST dim with the
same rule when the reading is not live, and MUST NOT add height to that row.

Whenever that row is not on screen — folded to its summary bar, hidden by zen, or absent because the
pane has no strips — the composer's own status band SHALL carry the word instead, so the state is
never spelled nowhere and never spelled twice. A band left with neither the state nor a machine to
name MUST leave rather than stand empty, and MUST arrive and leave as an animated in-flow
transition.

#### Scenario: The strip row is on screen
- **WHEN** the pane draws its strip row
- **THEN** the state appears as a badge at that row's trailing end before the fold control, and the composer's band shows no state word

#### Scenario: The strip row is not on screen
- **WHEN** the strips are folded, zen is on, or the pane has no strip row at all
- **THEN** the composer's band carries the state word again

#### Scenario: The band has nothing to carry
- **WHEN** the state is shown above and no machine needs naming
- **THEN** the band is not drawn at all and its removal is animated rather than instant

#### Scenario: The reading is stale
- **WHEN** the connection is not live
- **THEN** the badge dims by the same rule every other status surface uses

### Requirement: The controls under the mirror read as one rank
Every control in the row beneath the mirror SHALL draw its icon beside its word at one icon size and
one box, including the display control, which MUST carry its own word rather than standing as an
unlabelled icon. Each control MUST keep its existing action, its existing accessible name, its
existing pressed or expanded state, and the row's existing touch-target height.

#### Scenario: Operator reads the control row
- **WHEN** the pane's control row is drawn
- **THEN** every control shows an icon beside a word, at the same icon size and in the same box, and none is drawn as a bare icon

#### Scenario: Operator opens a control's surface
- **WHEN** the operator activates any control in that row
- **THEN** it opens, closes, or arms exactly what it did before, with its existing accessible name

### Requirement: The Pane route declines the shared mark
The application header SHALL let a route decline the Collie mark without taking the whole row, and
the Pane route SHALL decline it. Every other route SHALL keep it. Declining the mark MUST NOT change
the row's height, its safe-area handling, its prerelease strip, its rule, or any other route's
header.

#### Scenario: Operator opens a Pane
- **WHEN** the Pane route owns the header row
- **THEN** no Collie mark is drawn and the row's height and rule are unchanged

#### Scenario: Operator returns to a route that keeps the mark
- **WHEN** the operator navigates from a Pane to the dashboard
- **THEN** the mark is drawn again without remounting the header
