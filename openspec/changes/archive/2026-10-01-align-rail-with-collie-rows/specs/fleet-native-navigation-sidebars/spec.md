## MODIFIED Requirements

### Requirement: Wide layouts expose independent local sidebars
On a wide viewport (from 80rem) Herdr Fleet SHALL display a local Host → Space → Tab → Pane hierarchy
to the left of the native route column. From a wider viewport (96rem) it SHALL also display a local
Agent rail to the right. Fleet MUST NOT offer a control that permanently hides a rail that stands at
the current width.

Between those two widths only the hierarchy rail stands, and its drawn width SHALL be capped so the
route column keeps at least 66rem — wider than the whole viewport the drawer layout gives the route at
64rem — so a viewport that gains a rail never leaves the route narrower than a viewport that has
none. From 96rem both rails stand at their preferred widths.

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
- **THEN** no collapse or restore control is exposed, every rail that stands at that width is expanded, each returns at its stored bounded width, and every rail row remains reachable by keyboard

#### Scenario: The viewport is 80rem wide
- **WHEN** the viewport is at least 80rem and below 96rem
- **THEN** the hierarchy rail stands, the Agent rail does not, and the route column is wider than the route column of a 64rem viewport

#### Scenario: The viewport is 96rem wide
- **WHEN** the viewport is at least 96rem
- **THEN** both rails stand at their preferred widths

#### Scenario: Reduced motion is requested
- **WHEN** the browser reports a reduced-motion preference
- **THEN** the shell remains fully operable without non-essential rail, drawer, or overlay transition motion

### Requirement: Responsive navigation surfaces are mutually exclusive and focus-safe
Below the hierarchy rail's threshold, Herdr Fleet SHALL keep the existing route content native,
SHALL NOT add a navigation row of its own to the route column, and SHALL expose the hierarchy through
one trigger in the leading position of the existing application header.

An open hierarchy surface MUST render above every other Fleet and Collie surface in the route
column, and the content behind it MUST be inert and hidden from the accessibility tree. Closing it
through its close control, backdrop, Escape key, or completed navigation SHALL restore focus to the
header trigger when that trigger remains available. Overlay controls and hierarchy rows MUST be
operable by keyboard.

Below the Agent rail's threshold the Agent surface SHALL be the Pane page's existing pane-switcher
entry, and Fleet MUST NOT add a second Agent trigger or Agent drawer of its own.

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

#### Scenario: Only the hierarchy rail stands
- **WHEN** the viewport is wide enough for the hierarchy rail and not for the Agent rail
- **THEN** the Pane page offers its pane-switcher entry, and the entry presents the Agent rail's rows

### Requirement: Agent rail reuses native Agent behavior
The wide-layout Agent rail and the narrow-layout Agent surface SHALL present the same Agent rows. They
SHALL lead with a Pinned group holding this device's pinned Agent panes in the adopted Collie's own
pinned order, under Collie's muted section caption with no dot and no count. The remaining rows SHALL
follow ordered by Collie's own triage — its sections, their labels, their order and their contents —
with each pinned pane listed once, in the Pinned group. A section left with no rows SHALL be dropped;
a section heading SHALL count every pane of its bucket, pinned or not, so no two headings count one
pane. Triage section headings SHALL use Collie's workspace-heading voice — foreground ink, 13px, the
label in its own case — except where Collie itself renders a section in its alert accent. Shell rows
MUST NOT be introduced into the Agent surface.

Above the groups the rail SHALL draw the dashboard's own summary line over every Agent: its all-clear
wording SHALL appear exactly when the dashboard's would — when no pane needs the operator and none is
finished and unseen — and otherwise the same counts with their words. The rail MUST NOT spell the
same fact in different words from the dashboard.

The row itself is fork-owned. It SHALL lead with the shortcut ordinal a later keyboard shortcut can
address, then the Pane's state as Collie's status dot, then the Agent's 16px mark, and it SHALL say
WHERE the work is before WHAT it is doing: the Space in a muted style, then the name the operator gave
the work in the plain one at 16px and medium weight, with Collie's unseen mark after it; beneath it,
in 12px muted type, Collie's pane meta, then what the Pane is doing, with the row's age at that line's
trailing end. The name SHALL follow the same rule the hierarchy uses —
the operator's own Pane name, else the Tab's, never a number the multiplexer assigned. The row SHALL
carry the `data-glide` part names Collie's own rows carry for the dot, the mark and the name.

Collie's own Agent list and card MUST remain unchanged apart from the star port, so every other
surface that renders them is unaffected. The navigation shell MUST NOT add a pin or favourite store,
alter triage, change manual Pane fit, or create a separate Agent fetch or backend model.

#### Scenario: Favorites change while the Agent rail is visible
- **WHEN** the operator stars a rail row, or pins its pane from Collie's own sheet
- **THEN** the row leaves its triage section for the Pinned group at the top of the rail, its section heading still counts it, and the shell adds no navigation or request behavior

#### Scenario: The dashboard says something is unseen
- **WHEN** no pane is blocked and one finished pane is unseen
- **THEN** the rail's summary line names the unseen count with its word, as the dashboard's does, and does not say that nothing needs the operator

#### Scenario: Operator opens an Agent from the responsive overlay
- **WHEN** the operator activates the Pane page's pane-switcher entry and then activates an Agent row
- **THEN** the same rows are presented in that entry's existing sheet, Collie's existing Pane navigation runs once, and the sheet closes

#### Scenario: Wide viewport hides the pane-switcher entry
- **WHEN** the Agent rail is shown
- **THEN** the Pane page exposes no pane-switcher entry and the Pane page's own composer, strips, and thread sidebar are unchanged

#### Scenario: A rail row is drawn
- **WHEN** a row stands for a Pane
- **THEN** it leads with its ordinal, its status dot and the Agent's 16px mark, the Space precedes the work's name on the first line in Collie's row type sizes, and what the Pane is doing follows beneath in 12px type

#### Scenario: More rows than a single key can address
- **WHEN** the rail holds more rows than one keypress can reach
- **THEN** the rows past that limit carry no ordinal, because a badge there would promise a shortcut that does not exist

#### Scenario: Existing Agent behavior evolves
- **WHEN** Collie changes its triage order or its pinned order in a compatible future update
- **THEN** the rail inherits that ordering rather than maintaining a duplicate of it

### Requirement: The phone's hierarchy is the rail arriving from the edge

The hierarchy surface presented below the wide-layout threshold SHALL wear the wide-layout rail's
own ground and its own title treatment, and SHALL present the same rows and footer. It MAY add only
what a drawer needs and a rail does not — a control that dismisses it — and MUST NOT introduce a
second visual treatment of the same surface. Both rails' titles and the drawer's title SHALL wear
Collie's sheet-title style: 14px, semibold, foreground ink, in the label's own case.

It SHALL leave a usable strip of the surface behind it visible, so it reads as a panel that can be
dismissed by tapping past rather than as a route the operator has navigated to, and its width SHALL
be capped near the wide-layout rail's own resting width rather than growing with the viewport.

The shared footer SHALL keep the existing Collie/TTYD surface selector and place the current page's
Herdr Fleet build identity beneath it. The selector SHALL be drawn as Collie's own segmented control:
segments with a small gap inside the footer's padding, the selected segment a filled primary pill
whose label meets 4.5:1 contrast, the unselected ones muted. The build identity SHALL stand in a row
of the same height, top rule and ground as Collie's bottom tab bar — 56px plus the bottom safe-area
inset — so on a route that shows that tab bar the footer's rule and the tab bar's rule meet on one
line. The desktop hierarchy rail SHALL render the same footer ordering. The footer build identity
SHALL be independent of selected host, member reachability, and release discovery. It SHALL preserve
development and available commit qualification and MUST NOT replace either surface choice or reduce
its keyboard, touch, or narrow-screen access.

#### Scenario: Operator opens the hierarchy on a phone
- **WHEN** the hierarchy surface is on screen below the wide-layout threshold
- **THEN** its ground, its title, its rows and its footer are the wide-layout rail's, with a dismiss control added

#### Scenario: The drawer stands on a wide phone
- **WHEN** the drawer is opened on a viewport wide enough that a share of it would exceed the rail's resting width
- **THEN** the drawer takes the capped width, and a strip of the surface behind it stays visible and tappable

#### Scenario: The hierarchy footer is drawn on desktop and mobile
- **WHEN** either native hierarchy surface is visible
- **THEN** the Collie/TTYD selector appears first and the current page's Herdr Fleet build identity appears beneath it

#### Scenario: The footer meets the tab bar
- **WHEN** the dashboard's tab bar is on screen beside the hierarchy rail, or beneath the open drawer
- **THEN** the build-identity row has the tab bar's height, rule and ground, and the two top rules are at the same vertical position

#### Scenario: The selected surface is read
- **WHEN** the selector is drawn in either theme
- **THEN** the selected segment is a filled primary pill whose label contrast is at least 4.5:1

#### Scenario: The page is a development build
- **WHEN** the current bundle carries a development build identity
- **THEN** both hierarchy surfaces retain that development qualification in their shared footer

#### Scenario: The selected host or release source changes
- **WHEN** host selection changes or published release evidence is unavailable
- **THEN** the footer's page build remains unchanged and both selector choices remain usable

### Requirement: A rail row's controls and facts sit at opposite corners
An Agent rail row SHALL place its star at its trailing end, centred on the row, and SHALL reserve that
width on the row so neither line runs under it; the age SHALL end the row's second line, immediately
inside that reserve. The star SHALL be drawn whether or not the row is pinned, because a control that
appears only on hover is a control a touch device does not have.

#### Scenario: A row is drawn on a touch device
- **WHEN** the rail lists a row that is not pinned
- **THEN** its star is still drawn, muted, at the row's trailing end

#### Scenario: A row carries an age
- **WHEN** the row's section dates its rows
- **THEN** the age ends the second line, beside the star's reserve rather than under the star

### Requirement: A rail row wears Collie's own treatment, and drops it where Collie drops it

An Agent rail row SHALL be drawn at Collie's own row density — the same 44px height its dashboard
rows state, the same ground, hover and press — and only the ARRANGEMENT inside that box may be the
fork's. A rail row and a dashboard row stand for the same object, so a reader MUST NOT have to learn
two sizes for one row.

The card treatment SHALL be reserved for the one section Collie marks in its alert accent — the panes
that need the operator now — read from Collie's own section data rather than restated. Every other
row, the Pinned group's included, SHALL be drawn flat in ONE bordered group per section rather than an
open-ended run of hairlines, with no radius, the hover on the row itself, and the blocked tint as the
only cue on a flat row. A finished, unseen row SHALL carry Collie's unseen mark after its name rather
than a card.

The row standing for the Pane currently on screen SHALL be marked `aria-current="page"` and drawn on
the accent ground, the way Collie's own pane switcher marks it.

A state drawn as a hollow ring SHALL be filled with the ground it actually sits on, which differs
between the two treatments.

Collie's own card component and every surface that renders it MUST remain unchanged apart from the
star port.

#### Scenario: A row in a section that wants a person
- **WHEN** the rail lists a row in the section Collie draws in its alert accent
- **THEN** the row is a 44px card with Collie's card edge, ground and shadow

#### Scenario: A row in a section that does not
- **WHEN** the rail lists a row outside that section, including a Ready·unseen or a pinned row
- **THEN** the row is flat, square and 44px tall, the run it belongs to is one bordered group, and an unseen row carries Collie's unseen mark

#### Scenario: Rows stand apart
- **WHEN** the alert section lists more than one card
- **THEN** the cards are separated rather than stacked flush against one another

#### Scenario: The pane on screen is listed
- **WHEN** a rail row stands for the Pane the route is showing
- **THEN** that row alone carries `aria-current="page"` and the accent ground

#### Scenario: A resting state sits on the card
- **WHEN** a row's state is drawn as a hollow ring
- **THEN** the ring is filled with the ground that row actually sits on, so it reads as a ring rather than as a notch cut out of the row

#### Scenario: The dashboard changes which sections it emphasises
- **WHEN** Collie changes which triage section carries its alert accent
- **THEN** the rail follows, because it reads that mark rather than keeping a copy of it

### Requirement: An Agent row says which host it came from
Each Agent row SHALL carry the host it belongs to through Collie's own pane meta — the borderless
host marker, cache reading and session marker Collie's dashboard rows end their first line with — so
the vocabulary and the styling are the ones every other host-aware Collie row already uses. In the
rail it SHALL lead the row's second line, because the rail's width cannot give its first line to the
name and the meta both, and the name is what tells two rows apart. The host
marker SHALL be absent on a snapshot with a single host, by the marker's own rule, and the rail MUST
NOT introduce a second way of naming a host.

#### Scenario: Agents from two members are listed
- **WHEN** the rail lists rows from more than one member
- **THEN** each row's second line leads with Collie's pane meta naming its host, in the borderless form the dashboard row uses

#### Scenario: A solo snapshot is listed
- **WHEN** the rail lists rows from one host only
- **THEN** no host marker is drawn on any row

### Requirement: Both rails collapse and restore together on one command
At widths where at least one rail stands, Fleet SHALL offer a command that collapses every rail that
stands together and restores them together, with the route column taking and giving back the
released width.

The transition SHALL animate bounded width and opacity rather than removing the rails outright, and
SHALL honour a request for reduced motion by reaching the identical final layout with no animation.

Collapsing SHALL preserve each rail's content, scroll position and disclosure state, and SHALL restore
each rail's preferred width on the way back. While collapsed, the rails and their separators SHALL be
inert and hidden from assistive technology. The command SHALL make no snapshot request and SHALL cause
no remote Pane resize. At widths where no rail stands, the command SHALL be unavailable.

#### Scenario: The rails are collapsed
- **WHEN** the command runs at a width where a rail stands
- **THEN** every standing rail and its separator transition to an inert, hidden state and the route column expands into the released width

#### Scenario: The rails are restored
- **WHEN** the command runs again
- **THEN** each rail returns to its preferred width with its content, scroll position and disclosure state as they were

#### Scenario: Reduced motion is requested
- **WHEN** the browser requests reduced motion
- **THEN** the rails reach the same final visible and inert state without a width or opacity animation

#### Scenario: The command is invoked on a narrow layout
- **WHEN** the command runs where no persistent rail exists
- **THEN** nothing changes and Fleet reports one bounded unavailable result
