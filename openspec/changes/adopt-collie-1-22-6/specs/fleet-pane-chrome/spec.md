## MODIFIED Requirements

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

The strips' fold SHALL be the adopted Collie's own. Since Collie 1.21 the strips no longer fold on
their own when the keyboard opens and stay as the operator's last tap left them, so Fleet SHALL keep
Collie's fold control at the tab row's trailing end rather than withhold it: it is the only way to
fold the strips. That control is a fold, not a state surface. Expanding the folded surface remains
available on that surface itself, and the folded bar is Collie's own, unchanged.

#### Scenario: The strip row is on screen
- **WHEN** the pane draws its strip row
- **THEN** the row's trailing end carries Collie's fold control and no Fleet state badge, and the state is read from Collie's own dots and header mark

#### Scenario: The strip row is not on screen
- **WHEN** the operator folds the strips to their summary bar
- **THEN** the bar is Collie's own, with no Fleet state word, and its accessible name is unchanged

#### Scenario: Operator looks for a fold control
- **WHEN** the strips are expanded and the operator taps Collie's fold control
- **THEN** the strips fold and stay folded, also while the keyboard opens and closes, and the folded bar is one tap from expanding

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
