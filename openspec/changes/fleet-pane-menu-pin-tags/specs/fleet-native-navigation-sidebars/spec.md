## ADDED Requirements

### Requirement: A Pane's pointer menu pins it and edits its tags
The fork's pointer context menu for a Pane SHALL offer the two per-pane verbs the Agent rail offers
beside each row: pinning and tag editing. The menu for a row that stands in for an elided Tab — the
single Pane that took its Tab's slot — SHALL keep the Tab's own actions and SHALL additionally offer
the same two verbs for the one Pane that row shows. A Tab group row that holds more than one Pane,
a Space row and a Host row SHALL NOT gain either verb.

The pin row SHALL read and write the adopted Collie's own per-device pin store exactly as Collie's
Pane actions sheet does: it SHALL be labelled as pinning when the Pane is not pinned and as
unpinning when it is, toggling it SHALL close the menu and report the same status Collie reports,
and the Agent rail's star SHALL reflect the result without a second store being written. The tag
row SHALL close the menu and open Fleet's existing tag assignment editor for exactly that Pane,
with every loading, conflict, failure and identity guard that editor already applies, and SHALL
perform no tag write until the operator edits an assignment there.

Neither verb types into a terminal, so neither SHALL be withheld by the read-only refusal or by the
host write block that withhold rename, focus and close; those refusals SHALL continue to withhold
exactly the verbs they withhold today. A shell Pane SHALL offer the pin row and SHALL NOT offer the
tag row. Collie's touch bottom sheets SHALL remain unchanged.

#### Scenario: Operator pins a Pane from the hierarchy
- **WHEN** the operator right-clicks an unpinned Agent Pane row in the hierarchy rail and chooses Pin to top
- **THEN** the menu closes, the Pane is pinned in Collie's pin store, and its star in the Agent rail is pressed

#### Scenario: Operator unpins a pinned Pane
- **WHEN** the operator right-clicks a pinned Pane row and chooses Unpin
- **THEN** the Pane is unpinned and its star in the Agent rail is no longer pressed

#### Scenario: Operator edits tags from the hierarchy
- **WHEN** the operator right-clicks an Agent Pane row and chooses Edit pane tags
- **THEN** the menu closes and the tag assignment editor opens for that Pane, with no tag written yet

#### Scenario: A merged single-Pane row is right-clicked
- **WHEN** the operator right-clicks a row that took its Tab's slot because that Tab holds one Pane
- **THEN** the menu offers the Tab's rename and close as before, plus Pin and Edit pane tags acting on that one Pane

#### Scenario: A Tab group row is right-clicked
- **WHEN** the operator right-clicks a row that groups more than one Pane under a Tab
- **THEN** the menu offers neither Pin nor Edit pane tags

#### Scenario: The device may not write
- **WHEN** the device is read-only or the Pane's host is refusing writes
- **THEN** the menu still offers Pin and Edit pane tags, and still withholds rename, focus and close with its existing notice

#### Scenario: A shell Pane is right-clicked
- **WHEN** the operator right-clicks a shell Pane row
- **THEN** the menu offers Pin and does not offer Edit pane tags
