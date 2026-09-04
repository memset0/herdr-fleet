## ADDED Requirements

### Requirement: A Host row's unreachable wording is the lead's own refusal
A Host row SHALL present a member as unreachable only when the lead reports that member as not
writable, or when its protocol is incompatible. Both are claims about the machine.

A receipt the lead has not refreshed recently enough SHALL NOT be presented as a machine being
unreachable, and SHALL NOT change the row's glyph or tint. Freshness is a statement about the lead's
last poll, whose cadence is the lead's own, so a member answering every request must not read as
down between two sweeps.

#### Scenario: The lead refuses writes to a member
- **WHEN** the lead reports a member as not writable, or as protocol-incompatible
- **THEN** the row presents it as unreachable, in the refusal styling

#### Scenario: The lead's receipt is merely old
- **WHEN** a member the lead still reports reachable has a receipt older than the presented tolerance
- **THEN** the row says nothing about reachability and keeps its ordinary glyph and tint

#### Scenario: The snapshot carries no roster
- **WHEN** a solo snapshot renders the row
- **THEN** the row asks no reachability question at all and presents the plain untinted glyph

### Requirement: A member that is genuinely not answering sits at the bottom, closed
A Host row the lead reports as not writable, or as protocol-incompatible, SHALL sort after every
member that is answering, and SHALL render closed rather than spilling its last-good rows into the
hierarchy. Among the members that are answering the lead SHALL come first, and the order SHALL
otherwise stay the roster's so the list does not reshuffle as panes come and go.

A closed unanswering member SHALL remain openable: its rows are the snapshot's last-good content, not
an error, and an operator who wants to look at them may. A member that is merely between the lead's
sweeps is answering, and is neither moved nor closed.

#### Scenario: One member stops answering
- **WHEN** the lead reports one member as not writable while the others answer
- **THEN** that member's row moves below the answering ones and renders closed, and the answering ones keep the roster's order with the lead first

#### Scenario: The operator opens an unanswering member
- **WHEN** the operator activates the disclosure of a member that is not answering
- **THEN** its last-good rows are shown, and closing it returns to the default

#### Scenario: A member is merely between sweeps
- **WHEN** a member the lead still reports reachable has an old receipt
- **THEN** its row keeps its place in the roster's order and stays open

