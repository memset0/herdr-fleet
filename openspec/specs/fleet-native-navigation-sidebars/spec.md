# fleet-native-navigation-sidebars Specification

## Purpose

Restores a persistent, responsive native navigation shell around Collie's existing route content
without adding a second router, data source, backend contract, or framed application surface.

## Requirements

### Requirement: Native route content remains inside one persistent shell
Herdr Fleet SHALL mount one root navigation shell around Collie's existing native route outlet and
its one application header. The shell and its wide-layout rails MUST remain mounted while the
browser navigates among Home, Space, and Pane routes. Existing route components, loaders, polling,
mutation behavior, header claims, and Pane-page controls MUST remain the content of the native
outlet and the native header.

On a wide viewport the rails SHALL be the outermost columns for the full height available to the
shell, and the application header SHALL span only the route column between them. The header MUST
keep its existing single-instance identity, safe-area handling, prerelease strip, route claims,
portalled route content, and hidden-row behavior.

Route content SHALL fill the route column. A route that is not a Pane MUST NOT constrain itself to a
narrower centred reading column, and its header MUST span the same width as its content. The Pane
and history routes keep their existing full-width presentation.

The shell MUST NOT use an iframe, `postMessage`, frame cache, duplicate router, alternate Gateway
model, or additional snapshot request. It MUST NOT repurpose the Pane page's existing thread
switcher as the wide-layout Agent rail.

#### Scenario: Operator navigates from Home to a Pane
- **WHEN** the operator follows native Space or Pane navigation inside the application
- **THEN** the centre outlet changes through the existing router while the same root shell, header instance, and applicable rails remain mounted

#### Scenario: Shell data is refreshed
- **WHEN** the existing root loader or poll supplies a new snapshot
- **THEN** the shell updates from that data without issuing its own snapshot request

#### Scenario: Wide layout draws the header
- **WHEN** both rails are shown
- **THEN** neither rail is overlapped by the header and the header's rule begins and ends at the route column

#### Scenario: A route that is not a Pane is displayed
- **WHEN** the dashboard, a Space, Settings, or Pack is the current route
- **THEN** its content fills the route column at every viewport width instead of being centred in a narrower reading column, and its header spans the same width as its content

#### Scenario: Pane route remains native
- **WHEN** the operator opens a Pane
- **THEN** the existing Pane route, composer, strips, actions, manual fit, and thread switcher remain native outlet content without a framed copy

### Requirement: Wide layouts expose independent local sidebars
On a wide viewport, Herdr Fleet SHALL display a local Host → Space → Tab → Pane hierarchy to the
left of the native route column and a local Agent rail to the right. Both rails SHALL be shown
whenever the viewport is wide, and Fleet MUST NOT offer a control that collapses or hides either
rail.

Each sidebar SHALL have an independent preferred width. Its separator SHALL be pointer-draggable and
keyboard operable, SHALL expose separator semantics and current bounds, and SHALL clamp width to
defined minimum and maximum values. A width chosen by the operator SHALL be restored on a later
visit in the same browser.

Reduced-motion preference MUST remove non-essential sidebar and overlay animation.

#### Scenario: Operator resizes the hierarchy sidebar with a keyboard
- **WHEN** focus is on the left separator and the operator uses its supported arrow or boundary keys
- **THEN** the left width changes within its bounds without changing the right width or route

#### Scenario: Operator collapses and restores a sidebar
- **WHEN** the operator looks for the collapse control on a wide viewport, and reloads a browser that once stored a collapsed rail
- **THEN** no collapse or restore control is exposed, both rails are expanded, each returns at its stored bounded width, and every rail row remains reachable by keyboard

#### Scenario: Reduced motion is requested
- **WHEN** the browser reports a reduced-motion preference
- **THEN** the shell remains fully operable without non-essential rail, drawer, or overlay transition motion

### Requirement: Responsive navigation surfaces are mutually exclusive and focus-safe
Below the wide-layout threshold, Herdr Fleet SHALL keep the existing route content native, SHALL NOT
add a navigation row of its own to the route column, and SHALL expose the hierarchy through one
trigger in the leading position of the existing application header.

An open hierarchy surface MUST render above every other Fleet and Collie surface in the route
column, and the content behind it MUST be inert and hidden from the accessibility tree. Closing it
through its close control, backdrop, Escape key, or completed navigation SHALL restore focus to the
header trigger when that trigger remains available. Overlay controls and hierarchy rows MUST be
operable by keyboard.

The narrow-layout Agent surface SHALL be the Pane page's existing pane-switcher entry, and Fleet
MUST NOT add a second Agent trigger or Agent drawer of its own.

#### Scenario: Operator opens the hierarchy on a narrow viewport
- **WHEN** the operator activates the header's hierarchy trigger
- **THEN** the hierarchy surface opens above all route content, no Fleet navigation row is drawn in the route column, and the content behind it is inert

#### Scenario: Agent overlay replaces an open hierarchy drawer
- **WHEN** the hierarchy surface is open and the operator reaches for the Agent list
- **THEN** Fleet exposes no Agent drawer of its own, and the Pane page's Agent sheet is reachable only once the hierarchy surface has closed, so at most one navigation surface is exposed to assistive technology

#### Scenario: Operator closes with Escape
- **WHEN** keyboard focus is within the open hierarchy surface and the operator presses Escape
- **THEN** the surface closes and focus returns to the header trigger

#### Scenario: Operator navigates from the hierarchy
- **WHEN** a hierarchy Space or Pane row activates a native route
- **THEN** the responsive hierarchy surface closes, the native outlet navigates, and focus is not left inside hidden content

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

### Requirement: Agent rail reuses native Agent behavior
The wide-layout Agent rail and the narrow-layout Agent surface SHALL render the existing shared
native Agent list from the current root snapshot. They SHALL preserve its favorite-aware ordering,
triage sections, card behavior, row navigation, favorite controls, and browser-local favorite
semantics. Shell rows MUST NOT be introduced into the Agent rail.

On a narrow viewport the Agent surface SHALL be presented by the Pane page's existing pane-switcher
entry, in that entry's existing position, with its existing gesture and sheet, and named for its
Agent content. On a wide viewport that entry SHALL NOT be exposed, because the Agent rail is
already on screen.

The navigation shell MUST NOT redesign Agent cards, add another favorite store, alter triage,
change manual Pane fit, or create a separate Agent fetch or backend model.

#### Scenario: Favorites change while the Agent rail is visible
- **WHEN** the operator toggles an existing native Agent favorite control
- **THEN** the shared Agent list updates with its current favorite-aware ordering and the shell adds no navigation or request behavior

#### Scenario: Operator opens an Agent from the responsive overlay
- **WHEN** the operator activates the Pane page's pane-switcher entry and then activates an Agent row
- **THEN** the same native Agent list is presented in that entry's existing sheet, Collie's existing Pane navigation runs once, and the sheet closes

#### Scenario: Wide viewport hides the pane-switcher entry
- **WHEN** both rails are shown
- **THEN** the Pane page exposes no pane-switcher entry and the Pane page's own composer, strips, and thread sidebar are unchanged

#### Scenario: Existing Agent behavior evolves
- **WHEN** the shared Agent list changes its native ordering or card presentation in a compatible future update
- **THEN** both shell Agent surfaces inherit that behavior rather than maintaining a duplicate implementation

### Requirement: Navigation preferences are bounded and fail safe
Sidebar preferred widths and hierarchy disclosure state SHALL be independent, versioned
browser-local preferences with explicit byte, entry-count, identifier-length, and width bounds.
Unknown versions, malformed values, oversized records, duplicate disclosure identities, unavailable
storage, and read or write exceptions MUST leave the native application usable with safe bounded
defaults or bounded in-memory continuity.

A record written before rails became permanently expanded MUST remain readable: its bounded widths
and disclosure state SHALL be restored and any stored collapsed state SHALL be ignored rather than
discarding the whole record.

Preferences MUST NOT be sent to the Gateway, Collie bridge, Herdr, or another browser. They MUST
NOT contain Pane output, credentials, private configuration, or deployment identity.

#### Scenario: Stored preferences are valid
- **WHEN** the application starts with a supported bounded preference record
- **THEN** independent sidebar widths and disclosure choices are restored locally

#### Scenario: A record from an earlier shell is read
- **WHEN** the stored record still carries a collapsed state for either rail
- **THEN** the widths and disclosure state are restored, the collapsed state is ignored, and both rails are expanded

#### Scenario: Stored preferences are invalid
- **WHEN** the record is malformed, unsupported, oversized, duplicated, or outside a defined bound
- **THEN** the shell uses safe bounded defaults and performs no recovery request

#### Scenario: A preference write fails
- **WHEN** browser storage rejects a width or disclosure update
- **THEN** the current page keeps a bounded in-memory result and all native navigation remains usable

### Requirement: The shell's chrome stands on its own ground
The application header and both rails SHALL be filled with the same raised chrome ground the Pane
screen's composer dock uses, so the surfaces around the route read as chrome rather than as more of
the page. The route's own content and the terminal mirror SHALL keep their existing grounds.

Any drawing knocked out against the header's fill MUST be knocked out in that same value, so a
change of ground can never leave a halo behind.

#### Scenario: The application is drawn
- **WHEN** any route is on screen
- **THEN** the header and both rails share one raised ground, distinct from the route's content and from the mirror

#### Scenario: The mark is drawn on that ground
- **WHEN** a route keeps the Collie mark
- **THEN** the mark's knockout uses the header's own fill value

### Requirement: A hierarchy row carries its Pane's state
A hierarchy row that stands for a Pane SHALL show that Pane's state as the same dot Collie's Tab row
draws, at the row's trailing end, with the state's word available to assistive technology. The dot
MUST use the rail's own ground for a resting state's ring, and MUST NOT replace the Agent's own mark
at the row's leading end.

#### Scenario: An Agent row is drawn
- **WHEN** a row stands for a Pane running an Agent
- **THEN** the Agent's mark leads the row, the state's dot trails it, and both are drawn at once

#### Scenario: A row stands for no Pane
- **WHEN** a row is a Host, a Space, or a group of Panes
- **THEN** it carries no state dot of its own
