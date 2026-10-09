# fleet-pane-chrome Specification

## Purpose
Governs what the Pane screen spends its fixed rows on: where the pane's state is spelled, how its
controls are ranked, and which of the shared header's fixtures that route declines.

## Requirements

### Requirement: The pane's state is spelled once, in a row already being spent
Herdr Fleet SHALL add no pane-state surface of its own to the Pane screen. The adopted Collie already
states the pane's state on its pane header mark and draws a status dot on every tab and pane in its
strips and on every bead of the folded summary bar; those are the state, and Fleet MUST NOT add a
badge, a word or a band that repeats it — not at the tab row's trailing end, not at the folded bar's
trailing end, and not above the composer.

THE MACHINE THIS PANE WRITES TO SHALL BE NAMED ONCE ON THE PANE SCREEN, WHERE THE ADOPTED COLLIE NAMES
IT — at the end of the pane header's path line — and Fleet SHALL NOT add a second host chip to the app
bar or the composer. On a single-machine install nothing is drawn, by the chip's own existing rule.
What the chip says, how it shows an unreachable machine, and its accessible name are Collie's.

The strips SHALL fold and unfold automatically, and Fleet MUST NOT offer a second, manual control
that reaches the same state. Expanding the folded surface remains available on that surface itself,
and the folded bar is Collie's own, unchanged.

#### Scenario: The strip row is on screen
- **WHEN** the pane draws its strip row
- **THEN** the row's trailing end carries no Fleet state badge, and the state is read from Collie's own dots and header mark

#### Scenario: The strip row is not on screen
- **WHEN** the keyboard stands the strips down to their summary bar
- **THEN** the bar is Collie's own, with no Fleet state word, and its accessible name is unchanged

#### Scenario: Operator looks for a fold control
- **WHEN** the strips are expanded
- **THEN** no control offers to fold them, and the folded bar is still one tap from expanding

#### Scenario: There is no strip surface at all
- **WHEN** the pane has no strips, or zen has taken the chrome
- **THEN** Fleet draws no state band of its own, and the adopted Collie's own pane-state presentation is the only one

#### Scenario: The band has nothing to carry
- **WHEN** any Pane is on screen, with or without a strip surface
- **THEN** no composer status band is drawn at all, on a pack as well as on a single machine

#### Scenario: The reading is stale
- **WHEN** the connection is not live
- **THEN** Collie's own dots dim by their own rule, and Fleet has no state mark of its own left to dim

#### Scenario: The pane is on a pack
- **WHEN** the pane's writes land on a named machine
- **THEN** that machine is named once, at the end of the pane header's path line, and no second host chip appears in the app bar's trailing cluster or above the composer

### Requirement: The Pane route declines the shared mark
The application header SHALL let a route decline the Collie mark without taking the whole row, and
the Pane route SHALL decline it. Every other route SHALL keep it. Declining the mark MUST NOT change
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
