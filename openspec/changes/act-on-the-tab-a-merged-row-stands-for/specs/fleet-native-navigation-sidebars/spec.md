## MODIFIED Requirements

### Requirement: A hierarchy row reaches the actions Collie already has for it
A hierarchy row SHALL offer the actions Collie defines for the thing it stands for, reached by a
pointer's context gesture and by a touch long press, on any part of the row including its disclosure
control. A row standing for a Pane SHALL open Collie's existing Pane actions; a row grouping Panes
under a Tab SHALL open Collie's existing Tab actions. Both SHALL act on the Pane or Tab the current
snapshot describes.

A row that STANDS IN FOR AN ELIDED TAB — the single Pane that took its Tab's slot because that Tab
had no other Pane — SHALL offer the TAB's actions, not the Pane's. That row is the only row its Tab
has; the operator reading the tree sees a Tab holding one Pane. Renaming it therefore names the Tab,
which is also the name the row falls back to and so the one usually on screen, and closing it closes
the Tab rather than removing the Pane and leaving its container behind holding nothing. What the row
OPENS is unaffected — the Pane, because a Tab has no route of its own.

A row that stands for a Host or a Space SHALL offer no actions, because the bridge defines no rename
or close for either and a row must not offer what cannot land. Fleet MUST NOT define a second rename
or close, draw a menu of its own, or change what those sheets do — including their read-only
refusal, which MUST continue to apply when the device is not authorised to write.

Opening a row's actions MUST NOT activate the row. After a successful rename or close the shell
SHALL revalidate through the existing router, and closing the Pane the browser is currently viewing
SHALL return to the dashboard.

#### Scenario: Operator asks a Pane row for its actions
- **WHEN** the operator right-clicks or long-presses a row that stands for a Pane
- **THEN** Collie's Pane actions open for that Pane and the row is not activated

#### Scenario: Operator asks a Tab group row for its actions
- **WHEN** the operator right-clicks or long-presses a row that groups Panes under a Tab
- **THEN** Collie's Tab actions open for that Tab

#### Scenario: Operator asks a merged single-Pane row for its actions
- **WHEN** the operator right-clicks or long-presses a row that took its Tab's slot because that Tab holds one Pane
- **THEN** Collie's Tab actions open for that Tab, and activating the row still opens the Pane

#### Scenario: Operator asks a Space row for its actions
- **WHEN** the operator right-clicks or long-presses a Host or Space row
- **THEN** nothing opens, because there is no such action to offer

#### Scenario: The device may not write
- **WHEN** the device is not authorised, or holds no pairing credential
- **THEN** the sheet shows its existing read-only notice instead of the actions

#### Scenario: The open Pane is closed from the tree
- **WHEN** the operator closes the Pane the browser is currently viewing
- **THEN** the application returns to the dashboard; closing any other Pane revalidates in place
