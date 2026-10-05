## MODIFIED Requirements

### Requirement: A rail row wears Collie's own treatment, and drops it where Collie drops it

An Agent rail row SHALL use smaller title and detail type with more vertical breathing room than the former 44px row. It SHALL reserve a trailing action column on wide layouts and one trailing action row in compact layouts. Its content height SHALL have a stable minimum that fits the controls without inflating phone rows for vertical stacking. Touch targets SHALL remain independent. Narrow metadata SHALL fit inside the text region rather than intrude on controls or the time stamp. Assigned named colored tags SHALL remain below its content as specified by `fleet-pane-tags`, and text and tags MUST NOT overlap the action column. The row's background, border and hover/current/blocked treatment SHALL form one continuous surface around both its body and tag line.

The card treatment SHALL be reserved for the one section Collie marks in its alert accent — the panes
that need the operator now — read from Collie's own section data rather than restated. Every other
row, the Pinned group's included, SHALL be drawn flat in ONE bordered group per section rather than an
open-ended run of hairlines, with no radius, the hover on the row itself, and the blocked tint as the
only cue on a flat row. A finished, unseen row SHALL retain the flat row treatment.

The row standing for the Pane currently on screen SHALL be marked `aria-current="page"` and drawn on
the accent ground, the way Collie's own pane switcher marks it.

A state drawn as a hollow ring SHALL be filled with the ground it actually sits on, which differs
between the two treatments.

Collie's own card component and every surface that renders it MUST remain unchanged apart from the
star port.

#### Scenario: A row in a section that wants a person
- **WHEN** the rail lists a row in the section Collie draws in its alert accent
- **THEN** the row has a roomier content area in a card with Collie's card edge, ground and shadow

#### Scenario: A row in a section that does not
- **WHEN** the rail lists a row outside that section, including a Ready·unseen or a pinned row
- **THEN** the row is flat and square with a roomier content area, the run it belongs to is one bordered group, including an unseen row

#### Scenario: Rows stand apart
- **WHEN** the alert section lists more than one card
- **THEN** the cards are separated rather than stacked flush against one another

#### Scenario: The pane on screen is listed
- **WHEN** a rail row stands for the Pane the route is showing
- **THEN** that row alone carries `aria-current="page"` and the accent ground

#### Scenario: A resting state sits on the card
- **WHEN** a row's state is drawn as a hollow ring
- **THEN** the ring is filled with the ground that row actually sits on, so it reads as a ring rather than as a notch cut out of the row

#### Scenario: The dashboard changes which sections it emphasises
- **WHEN** Collie changes which triage section carries its alert accent
- **THEN** the rail follows, because it reads that mark rather than keeping a copy of it
