## RENAMED Requirements

- FROM: `### Requirement: Favorites sort first only inside existing triage sections`
- TO: `### Requirement: Favorites sort first only inside their own group`

## MODIFIED Requirements

### Requirement: Favorites sort first only inside their own group
The adopted Collie lays its dashboard out as workspace groups in a fixed place order, led by a Pinned
group of the panes pinned on this device; it no longer lays rows out by triage section. Inside each
workspace group, favorited Agents SHALL appear first within the group, before every non-favorited
row. Within both partitions the implementation MUST preserve the exact order the adopted Collie gives
that group.

The Pinned group SHALL be unaffected: it keeps Collie's own order whether or not its rows are
favorites, and favoriting never pins, unpins, or moves a row into or out of it.

Favorites MUST NOT create a new group, move a row across groups, change group order or counts, change
the dashboard tab, workspace filter or hidden machines, alter unseen/attention classification, change
polling or notification behavior, or replace Collie's ordering.

The Agent rail keeps Collie's triage buckets (`Needs you`, `Ready · unseen`, `Working`, `Recent`) as
the fleet's attention view; inside each bucket favorites likewise come first, in that bucket's own
order, and no row crosses a bucket.

#### Scenario: A favorite is added inside a section
- **WHEN** an Agent becomes favorited
- **THEN** it moves above the non-favorites of its own workspace group while retaining its relative order among that group's favorites

#### Scenario: A favorite is removed
- **WHEN** a favorite is removed
- **THEN** the Agent returns to the non-favorite partition of its group, in the group's own order

#### Scenario: A favorited Agent is pinned
- **WHEN** a favorited Agent is pinned on this device
- **THEN** it is listed in the Pinned group in Collie's own order, ahead of no other pinned row because it is a favorite

#### Scenario: A favorite changes triage status
- **WHEN** a favorited Agent's status changes
- **THEN** it keeps its place among its workspace group's favorites on the dashboard, and on the Agent rail it receives favorite priority only inside its new bucket

#### Scenario: Recent order is oldest-first
- **WHEN** this device's stored dashboard preference asks for oldest-first `Recent` order
- **THEN** no row moves because of it: the dashboard draws no `Recent` section, favorites still lead their own workspace group, and the Agent rail's `Recent` bucket keeps its own order with favorites first
