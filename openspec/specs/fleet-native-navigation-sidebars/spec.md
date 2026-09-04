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

A row that STANDS IN FOR AN ELIDED TAB — the single Pane that took its Tab's slot because that Tab
had no other Pane — SHALL offer the TAB's actions, not the Pane's. That row is the only row its Tab
has; the operator reading the tree sees a Tab holding one Pane. Renaming it therefore names the Tab,
which is also the name the row falls back to and so the one usually on screen, and closing it closes
the Tab rather than removing the Pane and leaving its container behind holding nothing. What the row
OPENS is unaffected — the Pane, because a Tab has no route of its own.

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

#### Scenario: Operator asks a merged single-Pane row for its actions
- **WHEN** the operator right-clicks or long-presses a row that took its Tab's slot because that Tab holds one Pane
- **THEN** Collie's Tab actions open for that Tab, and activating the row still opens the Pane

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

It SHALL leave a usable strip of the surface behind it visible, so it reads as a panel that can be
dismissed by tapping past rather than as a route the operator has navigated to, and its width SHALL
be capped near the wide-layout rail's own resting width rather than growing with the viewport.

#### Scenario: Operator opens the hierarchy on a phone
- **WHEN** the hierarchy surface is on screen below the wide-layout threshold
- **THEN** its ground, its title and its rows are the wide-layout rail's, with a dismiss control added

#### Scenario: The drawer stands on a wide phone
- **WHEN** the drawer is opened on a viewport wide enough that a share of it would exceed the rail's resting width
- **THEN** the drawer takes the capped width, and a strip of the surface behind it stays visible and tappable

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

### Requirement: A row's actions stand where the gesture asked for them

A row's actions SHALL be answered by ONE OF TWO SURFACES, and they SHALL be two components rather
than one component in two poses. Collie's own bottom sheet answers a device with a thumb and MUST
remain exactly as upstream draws it — its ground, its header, its handle, its close control, its row
height and its entrance. The fork's own context menu answers a mouse, at the cursor.

WHICH surface answers is decided at the INVOKE SITE, by the device: a machine driven by a fine,
hovering pointer whose context gesture opened the row gets the menu; every other machine, and every
other way of opening a row, gets the sheet. A recorded gesture SHALL be consumed whichever surface is
chosen, so one a phone made can never place a surface opened later.

The menu SHALL NOT dim the surface behind it, because the row it is about is the thing the operator
is checking it against. It SHALL leave on a press outside it, on Escape, and when the surface under
it moves, because it is anchored to a coordinate and a coordinate stops meaning anything once the
page scrolls. Its items SHALL be walkable by the arrow keys. It SHALL enter WITHOUT SCALING AND
WITHOUT TRAVEL: the box is already where the cursor is, so any motion is motion away from the thing
that caused it.

A menu SHALL be placed so that it is fully reachable: opening away from the cursor where there is
room, flipping to the other side of the cursor where there is not, and pinning inside the viewport
only when the surface is larger than the space on either side.

When the actions become a QUESTION rather than a list of verbs — a rename's field — the menu SHALL
give way to a prompt standing in the centre of the screen over a scrim, because a question is not
answered in a box pinned to a corner and sized for one-word rows. The sheet SHALL keep asking the
same question its own way, unchanged.

The menu MAY compose its own rows, and MUST NOT re-decide anything behind them: the capability gates,
the write refusals, the read-only refusal, the confirmation required before a destructive act, and
the writes themselves SHALL be the ones the sheet uses. The two surfaces MAY differ in shape and MUST
NOT differ in what they do.

#### Scenario: Operator right-clicks a row with a mouse

- **WHEN** the operator opens a row's actions with a mouse's context gesture on a machine with a fine pointer
- **THEN** the fork's menu is presented at the cursor with the same actions, the surface behind it is not dimmed, the bottom sheet is not mounted, and the menu is placed so that all of it is on screen

#### Scenario: Operator long-presses a row on a touch device

- **WHEN** the operator opens a row's actions with a touch long press
- **THEN** Collie's bottom sheet is presented, unchanged, and the fork's menu is not mounted

#### Scenario: The actions become a question

- **WHEN** the operator chooses rename from the menu
- **THEN** the menu gives way to a prompt in the centre of the screen, carrying the row's current name, and the write it performs is unchanged

#### Scenario: A gesture that opened nothing

- **WHEN** a context gesture is made and no actions surface opens promptly after it
- **THEN** that gesture places nothing later, and the next surface opened by any other means is the bottom sheet

#### Scenario: A machine with no fine pointer raises a context event

- **WHEN** a device without a fine, hovering pointer raises a context gesture, however it was typed
- **THEN** the bottom sheet is presented, and the gesture is discarded rather than left to place a later surface

#### Scenario: The page moves under an open menu

- **WHEN** the surface beneath an open menu scrolls or the window is resized
- **THEN** the menu closes, because what it was anchored to has moved

### Requirement: A rail row wears Collie's own treatment, and drops it where Collie drops it

An Agent rail row SHALL be drawn in Collie's own treatment — the same edge, the same ground, the
same shadow, the same hover and the same press its dashboard rows carry — and only the ARRANGEMENT
inside that box may be the fork's. A rail row and a dashboard row stand for the same object, so a
reader MUST NOT have to learn that one surface draws Panes as cards and the other draws them as bare
lines.

That treatment SHALL be reserved for the sections Collie itself reserves it for, and the rail SHALL
read Collie's own set rather than restate it. A card on every row is wallpaper rather than emphasis:
it discards the priority the triage order has already established, and the shape stops meaning
anything. Rows outside those sections SHALL be drawn flat, in ONE bordered group rather than an
open-ended run of hairlines, and SHALL take the rest of the flat treatment with it — no radius, the
hover on the row itself, and the blocked cue as a reserved left rail so the box never changes size.

A state drawn as a hollow ring SHALL be filled with the ground it actually sits on, which differs
between the two treatments.

Collie's own card component and every surface that renders it MUST remain unchanged; the set may be
exported, and nothing else in that file may move.

#### Scenario: A row in a section that wants a person

- **WHEN** the rail lists a row in a section Collie draws as cards
- **THEN** the row carries the same edge, ground, shadow, hover and press as Collie's own Agent card, and only the order of what is inside it is the fork's

#### Scenario: A row in a section that does not

- **WHEN** the rail lists a row outside those sections
- **THEN** the row is flat and square, and the run it belongs to is one bordered group

#### Scenario: Rows stand apart

- **WHEN** a section lists more than one card
- **THEN** the cards are separated rather than stacked flush against one another

#### Scenario: A resting state sits on the card

- **WHEN** a row's state is drawn as a hollow ring
- **THEN** the ring is filled with the ground that row actually sits on, so it reads as a ring rather than as a notch cut out of the row

#### Scenario: The dashboard changes which sections it emphasises

- **WHEN** Collie changes the set of sections it draws as cards
- **THEN** the rail follows, because it reads that set rather than keeping a copy of it

### Requirement: Both rails present every host in the pack
The hierarchy rail SHALL present one Host item per member the snapshot reports, each collapsible on
its own and each over that member's own Space, Tab and Pane rows. The Agent rail SHALL present the
Agent rows of every member, not only the member the current address belongs to.

Host order SHALL be stable across renders and SHALL place the lead first, so a rail does not reorder
itself as members come and go. A member the snapshot reports as unreachable SHALL keep the rows the
snapshot still carries for it, presented exactly as the snapshot marks them; the rails add no
reachability presentation of their own.

Activating a row SHALL open it with that row's own host and session rather than the address the
current route carries, so a row belonging to another member navigates to that member.

A snapshot reporting a single host SHALL render exactly as before: one Host item, the same rows in
the same order, and no host marker anywhere.

#### Scenario: The snapshot reports two members
- **WHEN** the lead's merged snapshot carries rows from itself and from one enrolled member
- **THEN** the hierarchy shows one collapsible Host item per member over that member's own rows, and the Agent rail lists both members' Agents

#### Scenario: A row on another member is activated
- **WHEN** the operator activates a Pane or Agent row belonging to a member other than the current address
- **THEN** the route opens that row on its own host and session

#### Scenario: One host is collapsed
- **WHEN** the operator collapses one Host item
- **THEN** only that member's rows are concealed and every other member's remain

#### Scenario: A member becomes unreachable
- **WHEN** the snapshot marks a member unreachable while still carrying its last rows
- **THEN** the rails keep presenting those rows as the snapshot describes them and invent no state of their own

#### Scenario: The snapshot reports one host
- **WHEN** a solo install renders the rails
- **THEN** the output is unchanged from before this change, with one Host item and no host marker

### Requirement: An Agent row says which host it came from
Each Agent row SHALL carry the host it belongs to, using Collie's own host marker so the vocabulary
and the styling are the ones every other host-aware Collie surface already uses. That marker SHALL be
absent on a snapshot with a single host, and the rail MUST NOT introduce a second way of naming a
host.

It SHALL take the marker's ORDINARY bordered form — the one Collie's own Agent card draws — and not
its borderless caption form, which exists for a line of chrome type rather than for a card. The line
it stands on SHALL align its contents with the marker rather than share a text baseline with it,
because a bordered box's baseline includes its own padding and would leave the runs beside it sitting
above it.

#### Scenario: Agents from two members are listed
- **WHEN** the rail lists rows from more than one member
- **THEN** each row carries Collie's own marker naming its host, in the bordered form the dashboard card uses, sitting on the line of the text beside it

#### Scenario: A solo snapshot is listed
- **WHEN** the rail lists rows from one host only
- **THEN** no host marker is drawn on any row

### Requirement: A Host row is the machine, and reports it

A Host row SHALL draw the machine it stands for in the column its disclosure control would occupy,
using Collie's own server glyph tinted with that machine's own colour — the same per-member tint
every other host-aware Collie surface uses — and SHALL NOT draw a disclosure arrow there. Every
member of the roster is a row in this list whether or not it holds anything, so the question the list
is scanned for is which machine each row is, and an arrow answers that for none of them.

The row SHALL report whether that machine is answering. When it is not — unreachable, never seen, or
refused on protocol — the glyph SHALL change as well as its colour, and the row SHALL say so in
words at its trailing end, in the position a Pane row's state occupies. Colour alone MUST NOT carry
the fact. A machine that is answering SHALL say nothing, and a snapshot with no roster at all SHALL
draw the plain untinted glyph and no word, because there is no such question on a single machine.

The row SHALL still disclose when it has children, and its disclosure state SHALL be announced on the
control that remains — the row's own label — so nothing is lost with the arrow. Fleet MUST NOT
introduce a second host health model, a second host palette, or a second vocabulary for a machine
that is down.

#### Scenario: The roster holds a member that is not answering

- **WHEN** the hierarchy lists a member the lead cannot reach
- **THEN** that row's glyph is the refusal one, in the refusal colour, and the row says it is unreachable in words

#### Scenario: The roster holds a member that is answering

- **WHEN** the hierarchy lists a member that is answering
- **THEN** that row's glyph carries the member's own tint and the row says nothing about its state

#### Scenario: A single-machine snapshot

- **WHEN** the hierarchy lists one machine and there is no roster
- **THEN** the row draws the plain glyph with no tint and no state word

#### Scenario: Operator opens and closes a Host row

- **WHEN** the operator activates a Host row that has children
- **THEN** it discloses and conceals as before, and its state is announced on the row's own label

### Requirement: The menu is measured for a cursor, and names its target only to a reader who needs it

The fork's context menu SHALL be drawn at a pointer's density — a narrow box with short rows and
small type — and MUST NOT inherit the bottom sheet's, whose width and 44px rows are a thumb's
measurements. The surface only exists on a machine that aims, so nothing in it is a tap target.

It SHALL NOT draw the name of the row it acts on. The menu stands on that row, a few pixels from the
name it would repeat, and it is the surface with the least room to spend on saying what the screen is
already saying. That name SHALL remain the menu's ACCESSIBLE NAME, because a reader who cannot see
the row underneath is exactly the reader who still needs it.

The bottom sheet is unaffected: it covers the app, so it keeps printing its target, and it keeps its
own density everywhere it is shown.

#### Scenario: The menu opens on a row

- **WHEN** the fork's menu is presented at the cursor
- **THEN** it draws its verbs and no name for the row, and its accessible name is that row

#### Scenario: The sheet opens on the same row

- **WHEN** the bottom sheet is presented instead
- **THEN** it still names the row in its own title row, at its own density

### Requirement: A Host row's unreachable wording is the lead's own refusal
A Host row SHALL present a member as unreachable only when the lead reports that member as not
writable, or when its protocol is incompatible. Both are claims about the machine.

A receipt the lead has not refreshed recently enough SHALL NOT be presented as a machine being
unreachable, and SHALL NOT change the row's glyph or tint. Freshness is a statement about the lead's
last poll, whose cadence is the lead's own, so a member answering every request must not read as
down between two sweeps.

#### Scenario: The lead refuses writes to a member
- **WHEN** the lead reports a member as not writable, or as protocol-incompatible
- **THEN** the row presents it as unreachable, in the refusal styling

#### Scenario: The lead's receipt is merely old
- **WHEN** a member the lead still reports reachable has a receipt older than the presented tolerance
- **THEN** the row says nothing about reachability and keeps its ordinary glyph and tint

#### Scenario: The snapshot carries no roster
- **WHEN** a solo snapshot renders the row
- **THEN** the row asks no reachability question at all and presents the plain untinted glyph

### Requirement: A member that is genuinely not answering sits at the bottom, closed
A Host row the lead reports as not writable, or as protocol-incompatible, SHALL sort after every
member that is answering, and SHALL render closed rather than spilling its last-good rows into the
hierarchy. Among the members that are answering the lead SHALL come first, and the order SHALL
otherwise stay the roster's so the list does not reshuffle as panes come and go.

A closed unanswering member SHALL remain openable: its rows are the snapshot's last-good content, not
an error, and an operator who wants to look at them may. A member that is merely between the lead's
sweeps is answering, and is neither moved nor closed.

#### Scenario: One member stops answering
- **WHEN** the lead reports one member as not writable while the others answer
- **THEN** that member's row moves below the answering ones and renders closed, and the answering ones keep the roster's order with the lead first

#### Scenario: The operator opens an unanswering member
- **WHEN** the operator activates the disclosure of a member that is not answering
- **THEN** its last-good rows are shown, and closing it returns to the default

#### Scenario: A member is merely between sweeps
- **WHEN** a member the lead still reports reachable has an old receipt
- **THEN** its row keeps its place in the roster's order and stays open

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

### Requirement: Both rails collapse and restore together on one command
At widths where the two rails stand, Fleet SHALL offer a command that collapses both the hierarchy
rail and the Agent rail together and restores them together, with the route column taking and giving
back the released width.

The transition SHALL animate bounded width and opacity rather than removing the rails outright, and
SHALL honour a request for reduced motion by reaching the identical final layout with no animation.

Collapsing SHALL preserve each rail's content, scroll position and disclosure state, and SHALL restore
each rail's preferred width on the way back. While collapsed, the rails and their separators SHALL be
inert and hidden from assistive technology. The command SHALL make no snapshot request and SHALL cause
no remote Pane resize. At widths where the pair of rails does not exist, the command SHALL be
unavailable.

#### Scenario: The rails are collapsed
- **WHEN** the command runs at a width where both rails stand
- **THEN** both rails and their separators transition to an inert, hidden state and the route column expands into the released width

#### Scenario: The rails are restored
- **WHEN** the command runs again
- **THEN** each rail returns to its preferred width with its content, scroll position and disclosure state as they were

#### Scenario: Reduced motion is requested
- **WHEN** the browser requests reduced motion
- **THEN** the rails reach the same final visible and inert state without a width or opacity animation

#### Scenario: The command is invoked on a narrow layout
- **WHEN** the command runs where the persistent pair of rails does not exist
- **THEN** nothing changes and Fleet reports one bounded unavailable result

### Requirement: A menu acts on the first activation; the sheet is the surface that asks again

The fork's context menu SHALL perform a destructive verb on the FIRST activation of its row, and MUST
NOT arm and ask a second time. It does not exist until a deliberate secondary click has been made, it
stands beside the pointer rather than under it, and reaching one of its rows requires travelling to
it and pressing again — the two deliberate acts a second tap would be standing in for.

Collie's bottom sheet SHALL keep its own confirmation exactly as upstream wrote it, including the
blast radius it names before closing a Tab, on every device that gets it. The two surfaces MAY differ
here because the gesture that reaches them differs; they MUST NOT differ in what the act does.

The refusals that decide whether the verb exists at all — the multiplexer capability, the read-only
refusal, the host write block — apply to both surfaces unchanged. They are not confirmations, and
nothing here relaxes them.

#### Scenario: Operator closes from the menu

- **WHEN** the operator activates a destructive row in the menu
- **THEN** the act runs immediately, with no armed state and no second ask

#### Scenario: Operator closes from the sheet

- **WHEN** the operator activates the same row in the bottom sheet
- **THEN** it arms and asks again, naming what closing costs, exactly as it does upstream

#### Scenario: The device may not write

- **WHEN** the device is not authorised, the multiplexer cannot perform the verb, or the host is refusing writes
- **THEN** neither surface offers the verb, whichever one was chosen
