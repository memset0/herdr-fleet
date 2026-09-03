## MODIFIED Requirements

### Requirement: Agent rail reuses native Agent behavior
The wide-layout Agent rail and the narrow-layout Agent surface SHALL present the same Agent rows,
ordered by Collie's own triage: its sections, their headings, their order, and their contents. Inside
each section the rows SHALL be ordered favorites-first from the existing browser-local favorite
store, and each row SHALL carry that store's toggle. Shell rows MUST NOT be introduced into the
Agent surface.

The row itself is fork-owned. It SHALL lead with the Agent's own mark, badged with the Pane's state
and with an ordinal a later keyboard shortcut can address, and it SHALL say WHERE the work is before
WHAT it is doing: the Space in a muted style, then the name the operator gave the work in the plain
one, with the row's age at that line's trailing end and what the Pane is doing beneath. The name
SHALL follow the same rule the hierarchy uses — the operator's own Pane name, else the Tab's, never
a number the multiplexer assigned. A row with nothing to say on its second line SHALL be one line
tall rather than padded to two.

Collie's own Agent list and card MUST remain unchanged, so every other surface that renders them is
unaffected. The navigation shell MUST NOT add another favorite store, alter triage, change manual
Pane fit, or create a separate Agent fetch or backend model.

#### Scenario: Favorites change while the Agent rail is visible
- **WHEN** the operator toggles a favorite from a rail row
- **THEN** that section reorders favorites-first from the same store and the shell adds no navigation or request behavior

#### Scenario: Operator opens an Agent from the responsive overlay
- **WHEN** the operator activates the Pane page's pane-switcher entry and then activates an Agent row
- **THEN** the same rows are presented in that entry's existing sheet, Collie's existing Pane navigation runs once, and the sheet closes

#### Scenario: Wide viewport hides the pane-switcher entry
- **WHEN** both rails are shown
- **THEN** the Pane page exposes no pane-switcher entry and the Pane page's own composer, strips, and thread sidebar are unchanged

#### Scenario: A rail row is drawn
- **WHEN** a row stands for a Pane
- **THEN** the Agent's mark leads it with the state at one corner and a shortcut ordinal at the other, the Space precedes the work's name on the first line, and what the Pane is doing follows beneath

#### Scenario: More rows than a single key can address
- **WHEN** the rail holds more rows than one keypress can reach
- **THEN** the rows past that limit carry no ordinal, because a badge there would promise a shortcut that does not exist

#### Scenario: Existing Agent behavior evolves
- **WHEN** Collie changes its triage order or its favorite-aware rules in a compatible future update
- **THEN** the rail inherits that ordering rather than maintaining a duplicate of it

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
name when it has one, and otherwise the name of the Tab it replaced. A value the terminal or the
Agent supplied is not such a name, because it repeats across sibling rows and names none of them;
neither is a Pane label consisting only of digits, which is the multiplexer numbering a Pane nobody
named. A Pane inside a Tab that survives keeps its existing name, which is what distinguishes it
from its siblings. A row SHALL present a group icon only when it still groups more than one child
after elision; a Space row SHALL present no icon of its own.

Every level SHALL use the same disclosure control with the same size and hit area. A row that has no
children SHALL draw no disclosure column, so the first thing inside its highlight is its own icon.
A disclosed level's guide line SHALL fall on the centre of the control that opened it, and its
children SHALL begin one control-width to the right of that control's own edge. The selected row's
highlight SHALL cover the whole row including its disclosure control, and SHALL NOT extend left of
the level's own edge.

Disclosure SHALL open and close as an animated in-flow transition, and MUST NOT animate when the
browser reports a reduced-motion preference. Hierarchy rows SHALL be denser than Collie's touch rows
on a wide viewport while remaining at least touch-sized wherever the hierarchy is operated as an
overlay, and the disclosure column, the indentation step and each rail's own title SHALL spend no
more of the rail's width or height than that.

The active Pane row SHALL be highlighted. Automatic disclosure of its surviving Space and Tab
ancestors SHALL happen when the selected Pane CHANGES — a deep link, a row in the Agent rail, a row
in this tree — and at no other time. A snapshot that changes no selection MUST NOT re-disclose a
branch the operator has collapsed. Operator disclosure choices for unrelated branches SHALL remain
independent.

#### Scenario: A Pane deep link becomes active
- **WHEN** the current route selects a Pane whose ancestry is closed in stored disclosure state
- **THEN** that Pane is highlighted and its surviving Space and Tab ancestry is disclosed without a request

#### Scenario: Operator collapses the branch they are standing in
- **WHEN** the operator conceals the Space holding the selected Pane and further snapshots arrive
- **THEN** the branch stays concealed until the selected Pane changes

#### Scenario: Operator collapses the machine
- **WHEN** the operator activates a Host row's disclosure control and later reloads the application
- **THEN** that Host is concealed on arrival, every other Host stays disclosed, and expanding it restores its Spaces

#### Scenario: A level holds one child
- **WHEN** a Space holds exactly one Tab, or a Tab holds exactly one Pane
- **THEN** that level is not drawn as its own row and its single child appears at the elided level under the child's icon and under the operator's own name for it

#### Scenario: Neither the Pane nor its Tab was named by the operator
- **WHEN** an elided Pane carries no name of its own
- **THEN** the row is named by its Tab rather than by a terminal or Agent supplied value

#### Scenario: The multiplexer numbered the Pane
- **WHEN** an elided Pane's only label is a run of digits
- **THEN** the row is named by its Tab, because the ordinal names nothing the operator chose

#### Scenario: A level holds several children
- **WHEN** a Tab holds more than one Pane
- **THEN** the Tab is drawn as a group row with a group icon, its own disclosure control, and its Panes indented one step beneath it

#### Scenario: A leaf row is drawn beside a parent
- **WHEN** a level holds both a row with children and a row without
- **THEN** the row without children draws no disclosure column and its icon begins at the level's own edge

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
