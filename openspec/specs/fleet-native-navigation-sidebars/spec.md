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

### Requirement: A hierarchy row reaches the actions Collie already has for it
A hierarchy row SHALL offer the actions Collie defines for the thing it stands for, reached by a
pointer's context gesture and by a touch long press, on any part of the row including its disclosure
control. A row standing for a Pane SHALL open Collie's existing Pane actions; a row grouping Panes
under a Tab SHALL open Collie's existing Tab actions. Both SHALL act on the Pane or Tab the current
snapshot describes.

A row that stands for a Host or a Space SHALL offer no actions, because the bridge defines no rename
or close for either and a row must not offer what cannot land. Fleet MUST NOT define a second rename
or close, draw a menu of its own, or change what those sheets do — including their read-only
refusal, which MUST continue to apply when the device is not authorised to write.

Opening a row's actions MUST NOT activate the row. After a successful rename or close the shell
SHALL revalidate through the existing router, and closing the Pane the browser is currently viewing
SHALL return to the dashboard.

#### Scenario: Operator asks a Pane row for its actions
- **WHEN** the operator right-clicks or long-presses a row that stands for a Pane
- **THEN** Collie's Pane actions open for that Pane and the row is not activated

#### Scenario: Operator asks a Tab group row for its actions
- **WHEN** the operator right-clicks or long-presses a row that groups Panes under a Tab
- **THEN** Collie's Tab actions open for that Tab

#### Scenario: Operator asks a Space row for its actions
- **WHEN** the operator right-clicks or long-presses a Host or Space row
- **THEN** nothing opens, because there is no such action to offer

#### Scenario: The device may not write
- **WHEN** the device is not authorised, or holds no pairing credential
- **THEN** the sheet shows its existing read-only notice instead of the actions

#### Scenario: The open Pane is closed from the tree
- **WHEN** the operator closes the Pane the browser is currently viewing
- **THEN** the application returns to the dashboard; closing any other Pane revalidates in place

### Requirement: The phone's hierarchy is the rail arriving from the edge
The hierarchy surface presented below the wide-layout threshold SHALL wear the wide-layout rail's
own ground and its own title treatment, and SHALL present the same rows. It MAY add only what a
drawer needs and a rail does not — a control that dismisses it — and MUST NOT introduce a second
visual treatment of the same surface.

#### Scenario: Operator opens the hierarchy on a phone
- **WHEN** the hierarchy surface is on screen below the wide-layout threshold
- **THEN** its ground, its title and its rows are the wide-layout rail's, with a dismiss control added

### Requirement: A rail row's controls and facts sit at opposite corners
An Agent rail row SHALL place its favourite control at its top trailing corner and its age at its
bottom trailing one, so a control and a fact never compete for the same position. The favourite
control SHALL be drawn whether or not the row is a favourite, because a control that appears only on
hover is a control a touch device does not have.

#### Scenario: A row is drawn on a touch device
- **WHEN** the rail lists a row that is not a favourite
- **THEN** its favourite control is still drawn, muted, at the row's top trailing corner

#### Scenario: A row carries an age
- **WHEN** the row's section dates its rows
- **THEN** the age is drawn at the row's bottom trailing corner, beneath the favourite control

### Requirement: The hierarchy has one density at every width
The hierarchy SHALL draw its rows at one compact height and one type size at every viewport width,
so the surface a phone opens is the surface a wide viewport keeps. A row SHALL carry horizontal
padding of its own, so a row with no disclosure control does not begin flush against the rail's edge.

Surfaces the operator aims at rather than scans — the Agent rows, the Pane page's strips and its
control row — keep their own touch-sized floors.

#### Scenario: The hierarchy is read on a phone
- **WHEN** the hierarchy surface is open below the wide-layout threshold
- **THEN** its rows are the same height and type size as the wide-layout rail's

#### Scenario: A leaf row is drawn
- **WHEN** a row has no disclosure control
- **THEN** its icon begins inside the row's own padding rather than at the surface's edge
