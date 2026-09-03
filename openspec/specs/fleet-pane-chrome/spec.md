# fleet-pane-chrome Specification

## Purpose
Governs what the Pane screen spends its fixed rows on: where the pane's state is spelled, how its
controls are ranked, and which of the shared header's fixtures that route declines.

## Requirements

### Requirement: The pane's state is spelled once, in a row already being spent
Herdr Fleet SHALL present the pane's state at the trailing end of whichever strip surface is on
screen, in pixels that surface is already spending and adding no height to it. While the strips are
expanded it SHALL be a badge carrying both a colour and the state's word, immediately before the row
uses its trailing end for anything else. While the strips are folded to their summary bar it SHALL
be the same colour and word without the badge's ground, because that bar is a fraction of a row's
height and a pill does not fit it. Both MUST dim by the same rule when the reading is not live, and
neither may join the accessible name of the control it sits beside.

Only where no strip surface exists at all — a pane with no strips, or zen — SHALL the composer's own
status band carry the word instead, so the state is never spelled nowhere and never spelled twice. A
band left with neither the state nor a machine to name MUST leave rather than stand empty, and MUST
arrive and leave as an animated in-flow transition.

The strips SHALL fold and unfold automatically, and Fleet MUST NOT offer a second, manual control
that reaches the same state. Expanding the folded surface remains available on that surface itself.

#### Scenario: The strip row is on screen
- **WHEN** the pane draws its strip row
- **THEN** the state appears as a badge at that row's trailing end, and the composer's band shows no state word

#### Scenario: The strip row is not on screen
- **WHEN** the keyboard stands the strips down to their summary bar
- **THEN** the state appears as a word at that bar's trailing end, the composer's band still shows none, and the bar's accessible name is unchanged

#### Scenario: Operator looks for a fold control
- **WHEN** the strips are expanded
- **THEN** no control offers to fold them, and the folded bar is still one tap from expanding

#### Scenario: There is no strip surface at all
- **WHEN** the pane has no strips, or zen has taken the chrome
- **THEN** the composer's band carries the state word again

#### Scenario: The band has nothing to carry
- **WHEN** the state is shown above and no machine needs naming
- **THEN** the band is not drawn at all and its removal is animated rather than instant

#### Scenario: The reading is stale
- **WHEN** the connection is not live
- **THEN** the badge and the word dim by the same rule every other status surface uses

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
