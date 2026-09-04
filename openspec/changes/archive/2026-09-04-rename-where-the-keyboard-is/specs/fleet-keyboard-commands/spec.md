## MODIFIED Requirements

### Requirement: Renaming and closing open the actions Collie already has
The **close** commands SHALL open Collie's own actions surface for the current Tab or Pane rather
than introducing a second confirmation. That surface already owns the two-activation confirmation,
the read-only refusal and the one mutation each close performs; a Fleet-owned copy of any of those
would be a second place for the same rules to drift.

The **rename** commands SHALL instead open a Fleet-owned input at the command bar's own position,
drawn on the same panel shell, because a rename begun from the keyboard must put its field where the
operator is already looking. It SHALL be prefilled with the target's current readable label with that
text selected, SHALL submit on `Enter`, and SHALL cancel on `Escape`, on dismissal, and on a change
of target or route. It MUST send exactly one rename, and only on submission. No rename path SHALL use
a browser prompt or an inline tree editor.

Renaming SHALL keep the meaning each target already has: a Tab requires a non-blank label, and a
blank submission SHALL stay in the input as a validation error without sending anything; a Pane's
blank submission SHALL clear its label, which is Collie's existing behavior. A device that may not
write SHALL be refused before the input opens.

Closing the currently displayed Pane SHALL select the same Host's safe Home route, and every other
close SHALL reconcile without a route change — exactly as activating the same action from a hierarchy
row already does.

A Space SHALL NOT have rename or close commands. This is a gap below this fork rather than a decision
it makes: the multiplexer's own RPC surface does expose renaming a workspace, but every layer between
that and the browser is absent — the capability is not declared, the multiplexer port carries no such
verb, no route serves it, and no client function calls it — and supplying them would require an
answer from every multiplexer adapter, not only the default one. A command that can never land is
worse than an absent command: it is a row in the catalog that fails every time it is chosen.

#### Scenario: A Tab is renamed from the keyboard
- **WHEN** `rename-tab` is invoked with a current Tab
- **THEN** an input opens where the command bar opens, holding that Tab's current name selected, and `Enter` sends exactly one rename

#### Scenario: A Pane is renamed from the keyboard
- **WHEN** `rename-pane` is invoked with a current Pane
- **THEN** the same input opens holding that Pane's readable label selected, and `Enter` sends exactly one rename for that Pane

#### Scenario: A Pane's label is cleared
- **WHEN** `rename-pane` is invoked and the operator submits an empty value
- **THEN** Fleet sends the clear Collie's own Pane rename already means by an empty label

#### Scenario: A Tab is given a blank name
- **WHEN** the operator submits an empty value while renaming a Tab
- **THEN** the input stays open with a validation error and nothing is sent

#### Scenario: The rename is abandoned
- **WHEN** the operator presses `Escape`, dismisses the input, or the route changes under it
- **THEN** the input closes and no rename is sent

#### Scenario: A Tab is closed from the keyboard
- **WHEN** `close-tab` is invoked and the operator confirms in Collie's own surface
- **THEN** exactly one close is sent through the path a hierarchy row already uses

#### Scenario: The device may not write
- **WHEN** a rename or close command is invoked on a read-only device
- **THEN** no input opens, no surface offers the action, and no mutation is sent

#### Scenario: A Space command is looked for
- **WHEN** the operator searches the command bar for a way to rename or close a Space
- **THEN** there is none, because the chain between the multiplexer's own rename and the browser does not exist

## ADDED Requirements

### Requirement: Creating a Tab uses the native create-and-jump flow
`create-tab` SHALL delegate to the same create-and-jump flow Collie's own surfaces use rather than
calling the create API directly. That flow carries the write gate, the API error message, the
snapshot reconciliation, and the handoff of the freshly created Pane to the route it navigates to.

The last of those is what makes the command work rather than merely fire: a Pane created a moment ago
is not in the snapshot yet, so a route reached without it reports an Agent that is gone.

#### Scenario: A Tab is created from the keyboard
- **WHEN** `create-tab` is invoked on a reachable Space
- **THEN** the new Tab's Pane is created once and the operator lands in it, with no interval in which the page claims the Agent is gone

#### Scenario: The device may not write
- **WHEN** `create-tab` is invoked on a read-only device
- **THEN** nothing is created and the refusal is the one Collie's own create already gives
