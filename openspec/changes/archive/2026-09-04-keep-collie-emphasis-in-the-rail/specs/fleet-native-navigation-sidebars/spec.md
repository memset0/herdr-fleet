## REMOVED Requirements

### Requirement: A rail row wears Collie's own card

**Reason**: Replaced by a requirement that also states where the card is DROPPED. Taking the box for
every row turned Collie's own emphasis into wallpaper — the shape stopped carrying the priority the
sections had already computed — so the treatment and the rule that withholds it are one requirement,
not two.

## ADDED Requirements

### Requirement: A rail row wears Collie's own treatment, and drops it where Collie drops it

An Agent rail row SHALL be drawn in Collie's own treatment — the same edge, the same ground, the
same shadow, the same hover and the same press its dashboard rows carry — and only the ARRANGEMENT
inside that box may be the fork's. A rail row and a dashboard row stand for the same object, so a
reader MUST NOT have to learn that one surface draws Panes as cards and the other draws them as bare
lines.

That treatment SHALL be reserved for the sections Collie itself reserves it for, and the rail SHALL
read Collie's own set rather than restate it. A card on every row is wallpaper rather than emphasis:
it discards the priority the triage order has already established, and the shape stops meaning
anything. Rows outside those sections SHALL be drawn flat, in ONE bordered group rather than an
open-ended run of hairlines, and SHALL take the rest of the flat treatment with it — no radius, the
hover on the row itself, and the blocked cue as a reserved left rail so the box never changes size.

A state drawn as a hollow ring SHALL be filled with the ground it actually sits on, which differs
between the two treatments.

Collie's own card component and every surface that renders it MUST remain unchanged; the set may be
exported, and nothing else in that file may move.

#### Scenario: A row in a section that wants a person

- **WHEN** the rail lists a row in a section Collie draws as cards
- **THEN** the row carries the same edge, ground, shadow, hover and press as Collie's own Agent card, and only the order of what is inside it is the fork's

#### Scenario: A row in a section that does not

- **WHEN** the rail lists a row outside those sections
- **THEN** the row is flat and square, and the run it belongs to is one bordered group

#### Scenario: Rows stand apart

- **WHEN** a section lists more than one card
- **THEN** the cards are separated rather than stacked flush against one another

#### Scenario: A resting state sits on the card

- **WHEN** a row's state is drawn as a hollow ring
- **THEN** the ring is filled with the ground that row actually sits on, so it reads as a ring rather than as a notch cut out of the row

#### Scenario: The dashboard changes which sections it emphasises

- **WHEN** Collie changes the set of sections it draws as cards
- **THEN** the rail follows, because it reads that set rather than keeping a copy of it
