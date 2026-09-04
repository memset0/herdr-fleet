## MODIFIED Requirements

### Requirement: A row's actions stand where the gesture asked for them

The actions a row offers SHALL be presented where the gesture that asked for them can be answered.
WHICH of the two surfaces exists is decided by the DEVICE — a machine driven by a fine, hovering
pointer gets the menu; every other machine gets the existing bottom sheet, unchanged, whatever kind
of event raised the gesture. WHERE the chosen surface stands is decided by the gesture: a context
gesture made with a mouse places the menu at the cursor. A recorded gesture SHALL be consumed
whichever surface is chosen, so one a phone made can never place a surface opened later.

A menu SHALL NOT dim the surface behind it, because the row it is about is the thing the operator is
checking it against; a sheet and a centred prompt MAY, because the panel has taken the screen over.

A menu SHALL APPEAR TO COME OUT OF THE CURSOR: it SHALL grow from the corner it is anchored by,
never from its own middle, which reads as the box being squeezed in from every side at once.

A menu SHALL wear a menu's chrome and not a sheet's. It MAY name the target it acts on as a caption,
and SHALL NOT carry a sticky or frosted title bar or a close control — it is dismissed by Escape, by
a click outside it, or by looking away, and a close button makes four verbs read as a dialog. The
bottom sheet's own header, handle and dismiss MUST remain exactly as they are.

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

- **WHEN** the operator opens a row's actions with a mouse's context gesture on a machine with a fine pointer
- **THEN** the same actions are presented at the cursor, the surface behind them is not dimmed, the box grows out of the corner the cursor is on, and the menu is placed so that all of it is on screen

#### Scenario: Operator long-presses a row on a touch device

- **WHEN** the operator opens a row's actions with a touch long press
- **THEN** the existing bottom sheet is presented, unchanged, including its grab handle, its title bar and its close control

#### Scenario: The actions become a question

- **WHEN** the operator chooses rename from a menu opened at the cursor
- **THEN** the same surface stands in the centre of the screen with the existing rename field, and the write it performs is unchanged

#### Scenario: A gesture that opened nothing

- **WHEN** a context gesture is made and no actions surface opens promptly after it
- **THEN** that gesture places nothing later, and the next surface opened by any other means stands where it always did

#### Scenario: A machine with no fine pointer raises a context event

- **WHEN** a device without a fine, hovering pointer raises a context gesture, however it was typed
- **THEN** the bottom sheet is presented, and the gesture is discarded rather than left to place a later surface

### Requirement: The phone's hierarchy is the rail arriving from the edge
The hierarchy surface presented below the wide-layout threshold SHALL wear the wide-layout rail's
own ground and its own title treatment, and SHALL present the same rows. It MAY add only what a
drawer needs and a rail does not — a control that dismisses it — and MUST NOT introduce a second
visual treatment of the same surface.

It SHALL leave a usable strip of the surface behind it visible, so it reads as a panel that can be
dismissed by tapping past rather than as a route the operator has navigated to, and its width SHALL
be capped near the wide-layout rail's own resting width rather than growing with the viewport.

#### Scenario: Operator opens the hierarchy on a phone
- **WHEN** the hierarchy surface is on screen below the wide-layout threshold
- **THEN** its ground, its title and its rows are the wide-layout rail's, with a dismiss control added

#### Scenario: The drawer stands on a wide phone
- **WHEN** the drawer is opened on a viewport wide enough that a share of it would exceed the rail's resting width
- **THEN** the drawer takes the capped width, and a strip of the surface behind it stays visible and tappable
