## MODIFIED Requirements

### Requirement: An Agent row says which host it came from
Each Agent row SHALL carry the host it belongs to, using Collie's own host marker so the vocabulary
and the styling are the ones every other host-aware Collie surface already uses. That marker SHALL be
absent on a snapshot with a single host, and the rail MUST NOT introduce a second way of naming a
host.

It SHALL take the marker's ORDINARY bordered form — the one Collie's own Agent card draws — and not
its borderless caption form, which exists for a line of chrome type rather than for a card. The line
it stands on SHALL align its contents with the marker rather than share a text baseline with it,
because a bordered box's baseline includes its own padding and would leave the runs beside it sitting
above it.

#### Scenario: Agents from two members are listed
- **WHEN** the rail lists rows from more than one member
- **THEN** each row carries Collie's own marker naming its host, in the bordered form the dashboard card uses, sitting on the line of the text beside it

#### Scenario: A solo snapshot is listed
- **WHEN** the rail lists rows from one host only
- **THEN** no host marker is drawn on any row
