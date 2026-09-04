## MODIFIED Requirements

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
band left with nothing to carry MUST leave rather than stand empty, and MUST arrive and leave as an
animated in-flow transition.

THE MACHINE THIS PANE WRITES TO SHALL BE NAMED IN THE APP BAR'S TRAILING CLUSTER, not in that band.
The app bar already carries this pane's identity and spends no height on one more node, while the
band is a row of its own — so a pack MUST NOT cost a row to say one name, and the band MUST be able
to leave once the state has gone above it. On a single-machine install nothing is drawn in either
place, by the chip's own existing rule. Every other surface that draws the composer keeps the machine
where it already stood, and what the chip says, how it shows an unreachable machine, and its
accessible name are unchanged wherever it stands.

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
- **WHEN** the state is shown above
- **THEN** the band is not drawn at all — on a pack as well as on a single machine — and its removal is animated rather than instant

#### Scenario: The pane is on a pack
- **WHEN** the pane's writes land on a named machine
- **THEN** that machine is named in the app bar's trailing cluster, carrying its own unreachable treatment and accessible name, and the composer's band is not drawn for it

#### Scenario: The reading is stale
- **WHEN** the connection is not live
- **THEN** the badge and the word dim by the same rule every other status surface uses
