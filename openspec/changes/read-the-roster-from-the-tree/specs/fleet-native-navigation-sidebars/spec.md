## ADDED Requirements

### Requirement: A Host row is the machine, and reports it

A Host row SHALL draw the machine it stands for in the column its disclosure control would occupy,
using Collie's own server glyph tinted with that machine's own colour — the same per-member tint
every other host-aware Collie surface uses — and SHALL NOT draw a disclosure arrow there. Every
member of the roster is a row in this list whether or not it holds anything, so the question the list
is scanned for is which machine each row is, and an arrow answers that for none of them.

The row SHALL report whether that machine is answering. When it is not — unreachable, never seen, or
refused on protocol — the glyph SHALL change as well as its colour, and the row SHALL say so in
words at its trailing end, in the position a Pane row's state occupies. Colour alone MUST NOT carry
the fact. A machine that is answering SHALL say nothing, and a snapshot with no roster at all SHALL
draw the plain untinted glyph and no word, because there is no such question on a single machine.

The row SHALL still disclose when it has children, and its disclosure state SHALL be announced on the
control that remains — the row's own label — so nothing is lost with the arrow. Fleet MUST NOT
introduce a second host health model, a second host palette, or a second vocabulary for a machine
that is down.

#### Scenario: The roster holds a member that is not answering

- **WHEN** the hierarchy lists a member the lead cannot reach
- **THEN** that row's glyph is the refusal one, in the refusal colour, and the row says it is unreachable in words

#### Scenario: The roster holds a member that is answering

- **WHEN** the hierarchy lists a member that is answering
- **THEN** that row's glyph carries the member's own tint and the row says nothing about its state

#### Scenario: A single-machine snapshot

- **WHEN** the hierarchy lists one machine and there is no roster
- **THEN** the row draws the plain glyph with no tint and no state word

#### Scenario: Operator opens and closes a Host row

- **WHEN** the operator activates a Host row that has children
- **THEN** it discloses and conceals as before, and its state is announced on the row's own label
