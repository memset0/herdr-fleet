## MODIFIED Requirements

### Requirement: A Host row creates a workspace on its own machine

A Host row SHALL expose a New workspace action through the existing pointer context menu and touch actions sheet, including Hosts with no workspaces. Activating the action SHALL open the adopted Collie's New page with the selected Host named in the page's own machine address parameter, and with no Pane and no named session in that address, so the page addresses the Host's primary session independently of the current route's Host or session. The page's own machine select, folder field, start, revalidation, fresh-pane navigation and error reporting SHALL be used unchanged. Leaving the page without starting SHALL perform no write. The fork SHALL NOT patch the New page to fix its machine: the operator may still choose another machine in the page's own select, and the selected Host is the page's initial choice whenever that Host accepts writes.

The action SHALL respect device/pairing refusals, the selected Host's write refusal and its create-space capability. Refused or incompatible Hosts SHALL show the existing refusal instead of a live create action; unsupported multiplexers SHALL show their capability note. Opening the action SHALL leave other row actions unchanged.

#### Scenario: Operator right-clicks a Host
- **WHEN** the operator right-clicks a writable Host
- **THEN** the pointer menu offers New workspace without disclosing or navigating the Host row

#### Scenario: Operator creates on another Host
- **WHEN** the operator activates New workspace on a Host different from the route's Host
- **THEN** the New page opens with that Host chosen in its machine select, and a start from it addresses that Host's primary session with no ambient scope inheritance

#### Scenario: Operator creates on the lead
- **WHEN** the operator activates New workspace on the lead's Host row
- **THEN** the New page opens with the lead chosen, addressing the lead's primary session

#### Scenario: Operator long-presses an empty Host
- **WHEN** a touch operator long-presses a Host with no workspaces
- **THEN** its actions sheet offers the same New workspace action and opens the same page for that Host

#### Scenario: Creation is refused
- **WHEN** pairing, device authorization, the selected Host's health or its multiplexer refuses creation
- **THEN** the relevant existing refusal is shown in place of the action and the New page is not opened for another Host

#### Scenario: Target stops accepting writes
- **WHEN** the selected Host stops accepting writes after the New page opened on it
- **THEN** the page refuses the start with that Host's own refusal, and nothing is started on another Host unless the operator chooses it in the page's select
