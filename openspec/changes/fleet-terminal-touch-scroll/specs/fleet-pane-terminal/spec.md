## ADDED Requirements

### Requirement: A touch swipe over the terminal scrolls the remote program as a wheel would
On a touch device, a vertical one-finger swipe over the terminal surface SHALL reach the terminal as
mouse-wheel input, through the same emulator wheel path a desktop mouse wheel takes, so the remote
program receives a wheel report in its own mouse protocol and encoding when it tracks the mouse, and
the emulator's cursor-key fallback when it does not. One wheel step SHALL be produced per cell height
of accumulated vertical finger travel, at the terminal's current line spacing; travel short of a cell
SHALL be kept for the rest of the same swipe. The direction SHALL be natural: a finger moving up SHALL
produce wheel-down steps and a finger moving down wheel-up steps.

A touch SHALL only become a swipe once it has travelled past a small slop and mostly vertically. A
tap, a long press without travel, a mostly horizontal swipe and any touch with more than one finger
SHALL produce no wheel input and SHALL be left to the browser. While a touch is a swipe, the page
itself SHALL NOT scroll. Mouse and wheel input from a pointer device SHALL be unchanged.

#### Scenario: The operator swipes up over a program that tracks the mouse
- **WHEN** the operator moves one finger up over the terminal by three cell heights while the program has mouse tracking on
- **THEN** three wheel-down reports reach the program, at the cell where the swipe began, and the page does not scroll

#### Scenario: The program does not track the mouse
- **WHEN** the operator swipes over a full-screen program that has not enabled mouse tracking
- **THEN** the terminal sends the same cursor-key lines a desktop wheel would

#### Scenario: A tap or a sideways swipe
- **WHEN** the operator taps the terminal, or swipes mostly sideways, or touches it with two fingers
- **THEN** no wheel input is produced and the browser handles the touch as before

#### Scenario: Travel short of a cell
- **WHEN** a swipe has travelled less than one cell height
- **THEN** no wheel step has been sent yet, and that travel counts toward the next step of the same swipe
