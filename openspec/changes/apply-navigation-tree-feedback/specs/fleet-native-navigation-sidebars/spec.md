## MODIFIED Requirements

### Requirement: Hierarchy is derived locally and follows native routes
The hierarchy SHALL derive its Host, Space, Tab, and Pane structure only from the current root
snapshot's existing local host roster, workspaces, tabs, Agent panes, and shell panes. It SHALL
present one Host row per machine it can name, naming the machine being viewed from the existing
roster when the roster names it and from a generic label otherwise, with every Space beneath its
Host. A Host row SHALL carry the same disclosure control every other level uses and SHALL be
disclosed by default; collapsing one SHALL be remembered as a browser-local preference and SHALL NOT
be undone by navigation. The Host level is presentational: it MUST NOT claim Pack support, switch
Host, request another Host's data, or alter Collie's scope rules.

Activating a row that has children SHALL disclose or conceal those children and MUST NOT navigate.
Activating a Pane row SHALL use Collie's existing Pane route and scope rules, and activating a Space
row that has no children SHALL use Collie's existing Space route. Disclosure actions MUST only
change browser-local presentation state and MUST NOT navigate, mutate a Pane, refresh, revalidate,
or issue an API request.

A level that holds exactly one child SHALL be elided: the child is presented in its place, the
child's icon wins, and the elided level MUST NOT contribute a row, a disclosure control, or an
indentation step. The elided row SHALL be named by the name the operator chose — the Pane's own
name when it has one, and otherwise the name of the Tab it replaced — never by a value the terminal
or the Agent supplied, which repeats across sibling rows and names none of them. A Pane inside a Tab
that survives keeps its existing name, which is what distinguishes it from its siblings. A row SHALL
present a group icon only when it still groups more than one child after elision; a Space row SHALL
present no icon of its own.

Every level SHALL use the same disclosure control with the same size, hit area, and indentation
step. The selected row's highlight SHALL cover the whole row including its disclosure control.
Disclosure SHALL open and close as an animated in-flow transition, and MUST NOT animate when the
browser reports a reduced-motion preference. Hierarchy rows SHALL be denser than Collie's touch rows
on a wide viewport while remaining at least touch-sized wherever the hierarchy is operated as an
overlay.

The active Pane row SHALL be highlighted. Its surviving Space and Tab ancestors SHALL automatically
become disclosed whenever the selected Pane changes, including direct and history-based navigation.
Operator disclosure choices for unrelated branches SHALL remain independent.

#### Scenario: A Pane deep link becomes active
- **WHEN** the current route selects a Pane whose ancestry is closed in stored disclosure state
- **THEN** that Pane is highlighted and its surviving Space and Tab ancestry is disclosed without a request

#### Scenario: Operator collapses the machine
- **WHEN** the operator activates a Host row's disclosure control and later reloads the application
- **THEN** that Host is concealed on arrival, every other Host stays disclosed, and expanding it restores its Spaces

#### Scenario: A level holds one child
- **WHEN** a Space holds exactly one Tab, or a Tab holds exactly one Pane
- **THEN** that level is not drawn as its own row and its single child appears at the elided level under the child's icon and under the operator's own name for it

#### Scenario: Neither the Pane nor its Tab was named by the operator
- **WHEN** an elided Pane carries no name of its own
- **THEN** the row is named by its Tab rather than by a terminal or Agent supplied value

#### Scenario: A level holds several children
- **WHEN** a Tab holds more than one Pane
- **THEN** the Tab is drawn as a group row with a group icon, its own disclosure control, and its Panes indented one step beneath it

#### Scenario: Operator activates a Space that has children
- **WHEN** the operator activates a Space row that holds Tabs or Panes
- **THEN** the row discloses or conceals its children and no navigation occurs

#### Scenario: Operator selects a row
- **WHEN** a row is the selected Pane
- **THEN** its highlight covers the row from its disclosure control to its trailing edge

#### Scenario: Operator toggles an unrelated Space
- **WHEN** the operator expands or collapses a Space that does not contain the selected Pane
- **THEN** only local disclosure state changes, the transition is animated unless reduced motion is requested, and no navigation, revalidation, or API request occurs

#### Scenario: A shell Pane is present
- **WHEN** the existing root snapshot contains a local shell Pane
- **THEN** the Pane appears under its Host row in its existing Space, and its Tab where that level survives, and activates through the same native Pane path without becoming an Agent
