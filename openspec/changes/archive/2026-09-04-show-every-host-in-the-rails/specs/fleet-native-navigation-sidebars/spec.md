## ADDED Requirements

### Requirement: Both rails present every host in the pack
The hierarchy rail SHALL present one Host item per member the snapshot reports, each collapsible on
its own and each over that member's own Space, Tab and Pane rows. The Agent rail SHALL present the
Agent rows of every member, not only the member the current address belongs to.

Host order SHALL be stable across renders and SHALL place the lead first, so a rail does not reorder
itself as members come and go. A member the snapshot reports as unreachable SHALL keep the rows the
snapshot still carries for it, presented exactly as the snapshot marks them; the rails add no
reachability presentation of their own.

Activating a row SHALL open it with that row's own host and session rather than the address the
current route carries, so a row belonging to another member navigates to that member.

A snapshot reporting a single host SHALL render exactly as before: one Host item, the same rows in
the same order, and no host marker anywhere.

#### Scenario: The snapshot reports two members
- **WHEN** the lead's merged snapshot carries rows from itself and from one enrolled member
- **THEN** the hierarchy shows one collapsible Host item per member over that member's own rows, and the Agent rail lists both members' Agents

#### Scenario: A row on another member is activated
- **WHEN** the operator activates a Pane or Agent row belonging to a member other than the current address
- **THEN** the route opens that row on its own host and session

#### Scenario: One host is collapsed
- **WHEN** the operator collapses one Host item
- **THEN** only that member's rows are concealed and every other member's remain

#### Scenario: A member becomes unreachable
- **WHEN** the snapshot marks a member unreachable while still carrying its last rows
- **THEN** the rails keep presenting those rows as the snapshot describes them and invent no state of their own

#### Scenario: The snapshot reports one host
- **WHEN** a solo install renders the rails
- **THEN** the output is unchanged from before this change, with one Host item and no host marker

### Requirement: An Agent row says which host it came from
Each Agent row SHALL carry the host it belongs to, using Collie's own host marker so the vocabulary
and the styling are the ones every other host-aware Collie surface already uses. That marker SHALL be
absent on a snapshot with a single host, and the rail MUST NOT introduce a second way of naming a
host.

#### Scenario: Agents from two members are listed
- **WHEN** the rail lists rows from more than one member
- **THEN** each row carries Collie's own marker naming its host

#### Scenario: A solo snapshot is listed
- **WHEN** the rail lists rows from one host only
- **THEN** no host marker is drawn on any row
