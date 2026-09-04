## ADDED Requirements

### Requirement: A row's actions stand where the gesture asked for them

The actions a row offers SHALL be presented where the gesture that asked for them can be answered.
A context gesture made with a MOUSE SHALL present them at the cursor, as a menu; every other way of
asking — a touch long press above all — SHALL keep the existing bottom sheet unchanged. A menu
SHALL NOT dim the surface behind it, because the row it is about is the thing the operator is
checking it against; a sheet and a centred prompt MAY, because the panel has taken the screen over.

When those rows become a QUESTION rather than a list of verbs — a rename's field — the same surface
SHALL move to the centre of the screen, because a question is not answered in a popover pinned to a
corner.

A menu SHALL be placed so that it is fully reachable: opening away from the cursor where there is
room, flipping to the other side of the cursor where there is not, and pinning inside the viewport
only when the surface is larger than the space on either side.

This is a PRESENTATION only. Fleet MUST NOT define a second set of actions, a second rename, a
second confirm, or a second write; the rows, their capability gating, their host block, their
read-only refusal and their outcomes remain exactly Collie's.

#### Scenario: Operator right-clicks a row with a mouse

- **WHEN** the operator opens a row's actions with a mouse's context gesture
- **THEN** the same actions are presented at the cursor, the surface behind them is not dimmed, and the menu is placed so that all of it is on screen

#### Scenario: Operator long-presses a row on a touch device

- **WHEN** the operator opens a row's actions with a touch long press
- **THEN** the existing bottom sheet is presented, unchanged, including its grab handle and its dismiss gesture

#### Scenario: The actions become a question

- **WHEN** the operator chooses rename from a menu opened at the cursor
- **THEN** the same surface stands in the centre of the screen with the existing rename field, and the write it performs is unchanged

#### Scenario: A gesture that opened nothing

- **WHEN** a context gesture is made and no actions surface opens promptly after it
- **THEN** that gesture places nothing later, and the next surface opened by any other means stands where it always did
