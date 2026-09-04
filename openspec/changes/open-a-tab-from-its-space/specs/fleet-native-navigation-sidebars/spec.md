## ADDED Requirements

### Requirement: A Space row opens a Tab, and offers nothing that cannot land

A Space row SHALL offer its own actions, containing every verb the chain from this tree to the
multiplexer can actually perform on a Space — today exactly one: open a new Tab in it. The act SHALL
be Collie's existing one, so its read-only gate, its refusal copy, its revalidation and its
navigation into the new Pane are unchanged, and Fleet MUST NOT define a second way to create a Tab.

It SHALL be offered through the same two surfaces every other row uses and chosen the same way: the
fork's menu for a pointer, Collie's bottom sheet for a thumb.

A Space row MUST NOT offer to rename a Space while no multiplexer capability, adapter verb, bridge
route or client call carries that write, whatever the multiplexer underneath may support on its own —
a row must never offer what cannot land. A Host row SHALL continue to offer nothing.

#### Scenario: Operator asks a Space row for its actions

- **WHEN** the operator right-clicks or long-presses a Space row
- **THEN** its actions open with the verb that opens a Tab in that Space, and no rename

#### Scenario: Operator opens a Tab from the tree

- **WHEN** the operator chooses that verb
- **THEN** Collie's own create runs, the herd revalidates, and the application navigates into the new Pane exactly as the tab strip's own control does

#### Scenario: The device may not write

- **WHEN** the device is not authorised, or holds no pairing credential
- **THEN** the surface shows the existing read-only notice instead of the verb

#### Scenario: The multiplexer cannot open a Tab

- **WHEN** the multiplexer does not declare that it can create a Tab
- **THEN** the verb is not drawn, and the adapter's own note takes its place
