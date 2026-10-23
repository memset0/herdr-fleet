## ADDED Requirements

### Requirement: The operator sets the terminal surface's line and character spacing
The application SHALL offer, among the Pane's display settings directly after the text size and only
while Panes are drawn as the real terminal, a line spacing and a character spacing for the terminal
surface. Line spacing SHALL be a multiplier from 1.0 to 2.0 in steps of 0.05 and character spacing a
pixel offset from −1 to 4 in steps of 0.5; their defaults SHALL be 1.0 and 0, which change nothing.
Both SHALL be stored per browser. A stored value that is absent, malformed, out of range or
unreadable SHALL be read as that setting's default.

A change SHALL apply to the terminal on screen without reconnecting or rebuilding it: its cell is
re-measured, and the resulting columns and rows SHALL reach the terminal through the ordinary
viewport report. A terminal retained across Pane switches SHALL be drawn at the current spacing when
it is shown again.

#### Scenario: Nothing has been set
- **WHEN** a browser has never set either spacing
- **THEN** the terminal is drawn with line height 1.0 and character spacing 0

#### Scenario: The operator changes a spacing
- **WHEN** the operator steps line or character spacing while a terminal is shown
- **THEN** the same terminal and connection are kept, the cell is re-measured, and the new columns and rows are reported to the terminal

#### Scenario: A stored value is malformed
- **WHEN** the stored spacing is not a number, is off its range, or cannot be read
- **THEN** that setting is its default and the terminal is still drawn
