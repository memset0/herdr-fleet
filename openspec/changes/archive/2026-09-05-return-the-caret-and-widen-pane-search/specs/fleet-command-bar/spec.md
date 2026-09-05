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

A row SHALL show one line of context beside its name, and SHALL use that one slot to say which fact
the query matched: a match on the Tab or on the host SHALL be shown there in place of the Space, with
the matched characters marked. The slot SHALL NOT appear, disappear or change size as a result, so
filtering never moves the row's contents.

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
- **WHEN** the operator types the name of the host a Pane is on
- **THEN** that Pane's row is listed, and it shows the host in its context slot with the match marked

#### Scenario: The operator remembers the Tab
- **WHEN** the operator types the name of the Tab a Pane sits in
- **THEN** that Pane's row is listed, and it shows the Tab in its context slot in place of the Space

#### Scenario: The match was the Pane's own name
- **WHEN** the operator types the Pane's own name
- **THEN** the name carries the marks and the context slot shows the Space, as it does unfiltered
