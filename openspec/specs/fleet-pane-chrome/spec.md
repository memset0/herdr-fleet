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

### Requirement: The Pane page's strips inherit the row-actions stand

The tab strip's and the pane strip's own row actions SHALL be answered by the same pair of surfaces
the hierarchy uses, chosen the same way, and SHALL define nothing of their own to achieve it. Each
strip MAY name a drop-in that takes the actions sheet's own props and renders that sheet unless the
menu was chosen; it MUST NOT gain a menu, a prompt, a gesture, or a placement of its own.

#### Scenario: Operator right-clicks a tab in the strip

- **WHEN** the operator opens a tab's actions from the strip with a mouse's context gesture
- **THEN** the fork's menu is presented at the cursor, with the same rows, gating and writes the bottom sheet shows

#### Scenario: The strips on a touch device

- **WHEN** the operator long-presses a tab or a pane in the strips
- **THEN** Collie's bottom sheet is presented, unchanged
