## MODIFIED Requirements

### Requirement: A Space row opens a Tab, and offers nothing that cannot land

A Space row SHALL offer its own actions, containing every verb the chain from this tree to the
multiplexer can actually perform on a Space — today exactly one: open a new Tab in it. The act SHALL
be Collie's existing one, so its read-only gate, its refusal copy, its revalidation and its
navigation into the new Pane are unchanged, and Fleet MUST NOT define a second way to create a Tab.

It SHALL be offered through the same two surfaces every other row uses and chosen the same way: the
fork's menu for a pointer, Collie's bottom sheet for a thumb.

A Space row MUST NOT offer to rename a Space while no multiplexer capability, adapter verb, bridge
route or client call carries that write, whatever the multiplexer underneath may support on its own —
a row must never offer what cannot land. Host workspace creation SHALL follow the separate Host action requirement.

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

## ADDED Requirements

### Requirement: A Host row creates a workspace on its own machine

A Host row SHALL expose a New workspace action through the existing pointer context menu and touch actions sheet, including Hosts with no workspaces. Activating the action SHALL open the existing creation form with the selected Host fixed and its primary session addressed, independently of the current route's Host or session. The form SHALL preserve optional name/directory fields and use the existing create, revalidation, fresh-pane navigation and error reporting. Closing without creating SHALL perform no write. The target MUST NOT silently fall back to a different Host.

The action SHALL respect device/pairing refusals, the selected Host's write refusal and its create-space capability. Refused or incompatible Hosts SHALL show the existing refusal instead of a live create action; unsupported multiplexers SHALL show their capability note. A Host becoming unavailable while the form is open SHALL prevent creation rather than retarget it. Creating SHALL leave other row actions unchanged.

#### Scenario: Operator right-clicks a Host
- **WHEN** the operator right-clicks a writable Host
- **THEN** the pointer menu offers New workspace without disclosing or navigating the Host row

#### Scenario: Operator creates on another Host
- **WHEN** the operator opens the form for a Host different from the route's Host and submits it
- **THEN** creation and fresh-pane navigation address that selected Host's primary session, with no ambient scope inheritance

#### Scenario: Operator long-presses an empty Host
- **WHEN** a touch operator long-presses a Host with no workspaces
- **THEN** its actions sheet offers the same create form and fixed target

#### Scenario: Creation is refused
- **WHEN** pairing, device authorization, the selected Host's health or its multiplexer refuses creation
- **THEN** the relevant existing refusal is shown and no create request is sent to another Host

#### Scenario: Target stops accepting writes
- **WHEN** the fixed Host becomes unavailable while the form is open
- **THEN** submitting creates nothing and the target never changes
