## MODIFIED Requirements

### Requirement: Pane mode lists a roster snapshot that never reorders
On opening in Pane mode, Fleet SHALL take one snapshot of the roster and SHALL present that snapshot,
unfiltered, for as long as the overlay stands. While the overlay is open, incoming state SHALL update
only what a row displays; it MUST NOT reorder the list, add a row, or remove one.

The snapshot SHALL be the roster's sections in their fixed order, flattened: `Needs you`,
`Ready · unseen`, `Working`, `Recent`, and last a `shell` section holding the Panes that are not
Agents. Inside every section, including `shell`, favorited rows SHALL come first while both partitions
keep that section's own order. The `shell` section SHALL order by last-seen, most recent first.

Typing SHALL fuzzy-match rows within that snapshot. A row SHALL be matched on every fact that names
its Pane — the Pane's own name, the Space it is in, the Tab it sits in, and the host it is on — and a
hit on any one of them SHALL list the row. A fact the Pane does not carry SHALL match nothing rather
than matching everything.

A ROW READS AS AN ADDRESS, leading with where the Pane lives rather than with what it is called. It
SHALL show, in this order: the Space it is in, de-emphasised; the Tab it sits in; the Pane's own name,
de-emphasised; and the host, as a tag. Every part SHALL be shown whether or not the query matched it,
and a part the Pane does not carry SHALL be absent rather than blank.

The host SHALL be named by the operator-facing name the rest of the application uses for that
machine, never by the internal identifier the snapshot tags a Pane with. It SHALL be shown only where
there is more than one machine, because naming the only machine on every row says nothing.

The characters a query matched SHALL be marked in the field they were matched in, and nowhere else.
Marking SHALL use the highest-contrast ink and an underline, and SHALL NOT change the weight, width
or size of anything: a mark that reflowed its own line would move the text under the operator's eyes
as they typed. The host tag SHALL NOT be marked — it says where the row is, not what was typed.

Activating a row SHALL navigate to that exact Pane through Fleet's canonical route. A row whose Pane
the topology has since removed SHALL remain listed, SHALL be shown as unavailable, and SHALL make no
route change when activated.

#### Scenario: The overlay opens in Pane mode
- **WHEN** `open-pane-switcher` runs
- **THEN** every Pane in the roster is listed in the section order above, with shell Panes last

#### Scenario: State lands while the overlay stands
- **WHEN** a Pane changes status, or its triage section would change, while the overlay is open
- **THEN** its row updates what it shows and the list's order, membership and length are unchanged

#### Scenario: A shell Pane is reached
- **WHEN** the operator filters to a Pane that is not an Agent and activates it
- **THEN** Fleet navigates to that Pane through the canonical route

#### Scenario: A listed Pane has gone away
- **WHEN** the operator activates a row whose Pane the topology no longer contains
- **THEN** Fleet changes no route and reports one bounded unavailable result

#### Scenario: The operator remembers the machine, not the Pane
- **WHEN** the operator types the displayed name of the host a Pane is on
- **THEN** that Pane's row is listed, and its host tag is shown without marks

#### Scenario: The operator remembers the Tab
- **WHEN** the operator types the name of the Tab a Pane sits in
- **THEN** that Pane's row is listed and the Tab carries the marks, with the Space and the Pane name plain

#### Scenario: The match was the Pane's own name
- **WHEN** the operator types the Pane's own name
- **THEN** the Pane name carries the marks and every other part is shown plain

#### Scenario: A row is read with no query at all
- **WHEN** the overlay is opened and nothing has been typed
- **THEN** every row already shows its Space, its Tab, its Pane name and its host, unmarked

#### Scenario: The lead's own Panes are named
- **WHEN** a Pane on the machine serving the application is listed on a pack
- **THEN** its tag carries that machine's operator-facing name, the same one the navigation rail shows

#### Scenario: There is only one machine
- **WHEN** the application is not part of a pack
- **THEN** no row carries a host tag
