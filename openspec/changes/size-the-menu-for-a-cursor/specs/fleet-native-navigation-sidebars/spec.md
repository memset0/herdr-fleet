## ADDED Requirements

### Requirement: The menu is measured for a cursor, and names its target only to a reader who needs it

The fork's context menu SHALL be drawn at a pointer's density — a narrow box with short rows and
small type — and MUST NOT inherit the bottom sheet's, whose width and 44px rows are a thumb's
measurements. The surface only exists on a machine that aims, so nothing in it is a tap target.

It SHALL NOT draw the name of the row it acts on. The menu stands on that row, a few pixels from the
name it would repeat, and it is the surface with the least room to spend on saying what the screen is
already saying. That name SHALL remain the menu's ACCESSIBLE NAME, because a reader who cannot see
the row underneath is exactly the reader who still needs it.

The bottom sheet is unaffected: it covers the app, so it keeps printing its target, and it keeps its
own density everywhere it is shown.

#### Scenario: The menu opens on a row

- **WHEN** the fork's menu is presented at the cursor
- **THEN** it draws its verbs and no name for the row, and its accessible name is that row

#### Scenario: The sheet opens on the same row

- **WHEN** the bottom sheet is presented instead
- **THEN** it still names the row in its own title row, at its own density
