## ADDED Requirements

### Requirement: The Agent rail marks every unseen pane seen in one tap
While at least one pane in the Agent rail's roster — every host's Agents, as the rail lists them —
is unseen by Collie's own rule, the rail's header SHALL offer a control beside the summary line that
marks all of them seen. The control SHALL show how many panes it will mark and SHALL name that count
in words to assistive technology. Activating it SHALL mark each of those panes seen through Collie's
existing per-pane seen signal, addressed to the pane's own host and session, and SHALL then
revalidate the route data so the rail, the summary line and the dashboard update from the next
snapshot. The control SHALL be disabled from activation until that revalidation settles, SHALL be a
keyboard-operable button, and SHALL be labelled in every shipped language. When no pane in the
roster is unseen the control SHALL NOT be drawn. The summary line SHALL keep its place whether or not
the control is drawn; where the rail is too narrow for both on one line, the control SHALL wrap
beneath the summary line rather than displace it. The Pane page's switcher sheet, which presents the same rail, SHALL present the same
control. A pane whose seen read fails SHALL stay unseen. The shell MUST NOT add a bridge route, a
batch endpoint or a client-side seen state for this.

#### Scenario: Unseen panes are present
- **WHEN** two finished panes, one on the lead and one on a peer, are unseen and the rail is shown
- **THEN** the rail's header shows the mark-all-seen control with the count 2 beside the summary line

#### Scenario: The operator marks all seen
- **WHEN** the operator activates the control
- **THEN** each unseen pane receives one seen read on its own host and session, the control is
  disabled until the route data has revalidated, and once the snapshot reports them seen the
  unseen marks and the control are gone

#### Scenario: Nothing is unseen
- **WHEN** no pane in the rail's roster is unseen
- **THEN** no mark-all-seen control is drawn

#### Scenario: A pane goes unseen again later
- **WHEN** after a mark-all a pane finishes again and the snapshot reports it unseen
- **THEN** its unseen mark and the control, with the new count, are shown as usual

#### Scenario: The phone's switcher sheet
- **WHEN** the operator opens the Pane page's switcher sheet while a pane is unseen
- **THEN** the sheet's rail shows the same control and activating it marks the panes seen
