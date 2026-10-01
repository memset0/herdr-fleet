## MODIFIED Requirements

### Requirement: Both rails present every host in the pack
The hierarchy rail SHALL present one Host item per member the snapshot reports, each collapsible on
its own and each over that member's own Space, Tab and Pane rows. The Agent rail SHALL present the
Agent rows of every member, not only the member the current address belongs to.

The rails are the fleet's map, not a view of the dashboard. A machine the dashboard hides on this
device, a pane it pins, and the dashboard tab or workspace filter chosen on it SHALL NOT change which
hosts and rows the rails present or their order; those choices stay the dashboard's own.

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

#### Scenario: The dashboard hides a machine
- **WHEN** the operator turns off a machine's dashboard visibility, pins a pane, or picks a dashboard tab on this device
- **THEN** both rails still present that machine and its rows, in the same order as before

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
