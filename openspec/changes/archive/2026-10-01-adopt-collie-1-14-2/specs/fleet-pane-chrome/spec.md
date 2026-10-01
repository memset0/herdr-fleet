## MODIFIED Requirements

### Requirement: The pane's state is spelled once, in a row already being spent
Herdr Fleet SHALL present the pane's state at the trailing end of whichever strip surface is on
screen, in pixels that surface is already spending and adding no height to it. While the strips are
expanded it SHALL be a badge carrying both a colour and the state's word, immediately before the row
uses its trailing end for anything else. While the strips are folded to their summary bar it SHALL
be the same colour and word without the badge's ground, because that bar is a fraction of a row's
height and a pill does not fit it. Both MUST dim by the same rule when the reading is not live, and
neither may join the accessible name of the control it sits beside.

Where no strip surface exists at all — a pane with no strips, or zen — Fleet SHALL add no state
surface of its own. The adopted Collie no longer draws a status band above its composer and states
the pane's state on its own header mark; that is what stands there, so the composer gains no row and
the state is never spelled twice.

THE MACHINE THIS PANE WRITES TO SHALL BE NAMED ONCE ON THE PANE SCREEN, WHERE THE ADOPTED COLLIE NAMES
IT — at the end of the pane header's path line — and Fleet SHALL NOT add a second host chip to the app
bar or the composer. On a single-machine install nothing is drawn, by the chip's own existing rule.
What the chip says, how it shows an unreachable machine, and its accessible name are Collie's.

The strips SHALL fold and unfold automatically, and Fleet MUST NOT offer a second, manual control
that reaches the same state. Expanding the folded surface remains available on that surface itself.

#### Scenario: The strip row is on screen
- **WHEN** the pane draws its strip row
- **THEN** the state appears as a badge at that row's trailing end, and no composer band is drawn

#### Scenario: The strip row is not on screen
- **WHEN** the keyboard stands the strips down to their summary bar
- **THEN** the state appears as a word at that bar's trailing end, and the bar's accessible name is unchanged

#### Scenario: Operator looks for a fold control
- **WHEN** the strips are expanded
- **THEN** no control offers to fold them, and the folded bar is still one tap from expanding

#### Scenario: There is no strip surface at all
- **WHEN** the pane has no strips, or zen has taken the chrome
- **THEN** Fleet draws no state band of its own, and the adopted Collie's own pane-state presentation is the only one

#### Scenario: The band has nothing to carry
- **WHEN** the state is shown above, or there is no strip surface
- **THEN** no composer status band is drawn at all, on a pack as well as on a single machine

#### Scenario: The pane is on a pack
- **WHEN** the pane's writes land on a named machine
- **THEN** that machine is named once, at the end of the pane header's path line, and no second host chip appears in the app bar's trailing cluster or above the composer

#### Scenario: The reading is stale
- **WHEN** the connection is not live
- **THEN** the badge and the word dim by the same rule every other status surface uses

## REMOVED Requirements

### Requirement: The controls under the mirror read as one rank
**Reason**: The adopted Collie replaced the row beneath the mirror with its actions belt, on which every pill — the display control included — is an icon and a word at one size (upstream `v1.9.0`). Upstream now does what this port did, so the port is dropped and its paths return to upstream's versions.
**Migration**: None for operators. The fork's control-rank constants in the composer are removed with the merge; the belt's own presentation is upstream behavior.
