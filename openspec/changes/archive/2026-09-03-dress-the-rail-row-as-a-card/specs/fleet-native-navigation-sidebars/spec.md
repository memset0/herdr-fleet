## ADDED Requirements

### Requirement: A rail row wears Collie's own card

An Agent rail row SHALL be drawn in Collie's own card treatment — the same edge, the same card
ground, the same shadow, the same hover and the same press its dashboard rows carry — and only the
ARRANGEMENT inside that box may be the fork's. A rail row and a dashboard row stand for the same
object, so a reader MUST NOT have to learn that one surface draws Panes as cards and the other draws
them as bare lines.

The row SHALL spend the card's own interior padding, and rows within a section SHALL be separated
rather than stacked flush, so a row reads as one object rather than as a run of lines. A state drawn
as a hollow ring SHALL be filled with the ground it actually sits on, which is the card's rather than
the rail's.

Collie's own card component and every surface that renders it MUST remain unchanged.

#### Scenario: A row is drawn beside the work

- **WHEN** the Agent rail lists a row
- **THEN** its box carries the same edge, ground, shadow, hover and press as Collie's own Agent card, and only the order of what is inside it is the fork's

#### Scenario: Rows stand apart

- **WHEN** a section lists more than one row
- **THEN** the rows are separated rather than stacked flush against one another

#### Scenario: A resting state sits on the card

- **WHEN** a row's state is drawn as a hollow ring
- **THEN** the ring is filled with the card's ground, so it reads as a ring rather than as a notch cut out of the row
