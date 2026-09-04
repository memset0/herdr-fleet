## MODIFIED Requirements

### Requirement: A row's actions stand where the gesture asked for them

A row's actions SHALL be answered by ONE OF TWO SURFACES, and they SHALL be two components rather
than one component in two poses. Collie's own bottom sheet answers a device with a thumb and MUST
remain exactly as upstream draws it — its ground, its header, its handle, its close control, its row
height and its entrance. The fork's own context menu answers a mouse, at the cursor.

WHICH surface answers is decided at the INVOKE SITE, by the device: a machine driven by a fine,
hovering pointer whose context gesture opened the row gets the menu; every other machine, and every
other way of opening a row, gets the sheet. A recorded gesture SHALL be consumed whichever surface is
chosen, so one a phone made can never place a surface opened later.

The menu SHALL NOT dim the surface behind it, because the row it is about is the thing the operator
is checking it against. It SHALL leave on a press outside it, on Escape, and when the surface under
it moves, because it is anchored to a coordinate and a coordinate stops meaning anything once the
page scrolls. Its items SHALL be walkable by the arrow keys. It SHALL enter WITHOUT SCALING AND
WITHOUT TRAVEL: the box is already where the cursor is, so any motion is motion away from the thing
that caused it.

A menu SHALL be placed so that it is fully reachable: opening away from the cursor where there is
room, flipping to the other side of the cursor where there is not, and pinning inside the viewport
only when the surface is larger than the space on either side.

When the actions become a QUESTION rather than a list of verbs — a rename's field — the menu SHALL
give way to a prompt standing in the centre of the screen over a scrim, because a question is not
answered in a box pinned to a corner and sized for one-word rows. The sheet SHALL keep asking the
same question its own way, unchanged.

The menu MAY compose its own rows, and MUST NOT re-decide anything behind them: the capability gates,
the write refusals, the read-only refusal, the confirmation required before a destructive act, and
the writes themselves SHALL be the ones the sheet uses. The two surfaces MAY differ in shape and MUST
NOT differ in what they do.

#### Scenario: Operator right-clicks a row with a mouse

- **WHEN** the operator opens a row's actions with a mouse's context gesture on a machine with a fine pointer
- **THEN** the fork's menu is presented at the cursor with the same actions, the surface behind it is not dimmed, the bottom sheet is not mounted, and the menu is placed so that all of it is on screen

#### Scenario: Operator long-presses a row on a touch device

- **WHEN** the operator opens a row's actions with a touch long press
- **THEN** Collie's bottom sheet is presented, unchanged, and the fork's menu is not mounted

#### Scenario: The actions become a question

- **WHEN** the operator chooses rename from the menu
- **THEN** the menu gives way to a prompt in the centre of the screen, carrying the row's current name, and the write it performs is unchanged

#### Scenario: A gesture that opened nothing

- **WHEN** a context gesture is made and no actions surface opens promptly after it
- **THEN** that gesture places nothing later, and the next surface opened by any other means is the bottom sheet

#### Scenario: A machine with no fine pointer raises a context event

- **WHEN** a device without a fine, hovering pointer raises a context gesture, however it was typed
- **THEN** the bottom sheet is presented, and the gesture is discarded rather than left to place a later surface

#### Scenario: The page moves under an open menu

- **WHEN** the surface beneath an open menu scrolls or the window is resized
- **THEN** the menu closes, because what it was anchored to has moved
