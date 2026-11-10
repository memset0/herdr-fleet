## MODIFIED Requirements

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

Route content SHALL fill the route column, and its header SHALL span the same width as its content.
No route MAY constrain itself to a narrower centred reading column — the Pane and history routes
included, which is stated because upstream centres them above the phone breakpoint and this fork
declines that, and every Settings page included, the index and each section it opens. The rails are what claims the width a centred column would otherwise leave empty, so a
cap inside them takes width from a terminal mirror rather than from emptiness, and the refusal is
declared in the fork manifest so an upstream release cannot reinstate it unreported.

The shell SHALL be a property of the Fleet build, decided when the bundle is built and never at
run time. Every production build of the browser bundle — the plugin's own build step, the
repository's root build and the lead's deployment — SHALL state that it is a Fleet build, and a bundle so built SHALL always mount the shell. A
bundle built without that statement, as upstream's component suites and browser tier build it,
SHALL render Collie's own root layout: no rails, no hierarchy trigger in the header, and the Pane
page's own switcher. Coverage of the shell-on layout, including how it nests Collie's header and
route column, SHALL live in fork-owned tests.

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
- **WHEN** the dashboard, a Space, the Settings index or any of its sections, or Pack is the current route
- **THEN** its content fills the route column at every viewport width instead of being centred in a narrower reading column, and its header spans the same width as its content

#### Scenario: A Pane or history route is displayed above the phone breakpoint
- **WHEN** the operator opens a Pane or its history on a viewport wide enough for upstream's centred column
- **THEN** its content fills the route column between the rails rather than being centred in a narrower one, and its header spans that same width

#### Scenario: An upstream release centres these routes again
- **WHEN** an upstream adoption's preflight is run against a release that changes the Pane or history routes' width
- **THEN** it reports those lines as a declared fork boundary, so the release's cap is decided against rather than inherited

#### Scenario: Pane route remains native
- **WHEN** the operator opens a Pane
- **THEN** the existing Pane route, composer, strips, actions, manual fit, and thread switcher remain native outlet content without a framed copy

#### Scenario: A bundle is built for Fleet
- **WHEN** the plugin's build step, the root build or the lead's deployment produces the browser bundle
- **THEN** that bundle mounts the shell on every route

#### Scenario: A bundle is built without the Fleet statement
- **WHEN** upstream's component suites or browser tier render the application
- **THEN** they meet Collie's own root layout, with no rail, no hierarchy trigger and Collie's own Pane switcher

#### Scenario: A Fleet Pane opens on a large screen
- **WHEN** Fleet opens a Pane above the native large-screen threshold
- **THEN** only Fleet navigation rails surround one Pane view, and the upstream large-screen layout control is absent


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
indentation step. The row SHALL use the filtered pane name even when its Tab has an explicit name. Tab grouping, row targets and rename/close subjects SHALL remain unchanged. Name filtering SHALL follow the separate pane-name requirement below.

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
- **THEN** that level is not drawn as its own row and its single child appears at the elided level under the child's icon and under its filtered pane name

#### Scenario: Neither the Pane nor its Tab was named by the operator
- **WHEN** an elided Pane carries no name of its own
- **THEN** the row uses a meaningful filtered pane title or the program/directory fallback without promoting the Tab label

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
The wide-layout Agent rail and the narrow-layout Agent surface SHALL present the same Agent rows. They
SHALL lead with a Pinned group holding this device's pinned Agent panes in the adopted Collie's own
pinned order, under Collie's muted section caption with no dot and no count. The remaining rows SHALL
follow Collie's own triage sections, labels, group order and membership, with Recent ordered by
descending `lastSeenAt` and Ready/Working by descending `lastActiveAt`; Needs SHALL retain its input
order. Equal timestamps SHALL preserve input order and missing timestamps SHALL follow timed rows.
The rail, command bar roster snapshot, next/previous navigation and numbered selection SHALL share
this same order,
with each pinned pane listed once, in the Pinned group. A section left with no rows SHALL be dropped;
a section heading SHALL count every pane of its bucket, pinned or not, so no two headings count one
pane. Triage section headings SHALL use Collie's workspace-heading voice — foreground ink, 13px, the
label in its own case — except where Collie itself renders a section in its alert accent. Shell rows
MUST NOT be introduced into the Agent surface.

Above the groups the rail SHALL draw the dashboard's own summary line over every Agent: its all-clear
wording SHALL appear exactly when the dashboard's would — when no pane needs the operator and none is
finished and unseen — and otherwise the same counts with their words. The rail MUST NOT spell the
same fact in different words from the dashboard.

The row itself is fork-owned. It SHALL lead with one integrated 32px Agent mark, with its shortcut ordinal at the lower-left corner and the Pane's state dot at the lower-right corner, and it SHALL say
WHERE the work is before WHAT it is doing: the Space in a muted style, then the name the operator gave
the work in the plain one at 12px and medium weight; beneath it,
in 11px muted type, what the Pane is doing. A reserved third line SHALL lead with host/session metadata, followed by tags, with the row's age at the trailing right edge. The avatar SHALL span only the first two text lines. Tags MAY wrap onto additional lines, with the age right-aligned on the last line. The name SHALL follow the same rule the hierarchy uses —
the filtered pane-name rule below, without promoting a Tab label or a positional pane number. The row SHALL
present the Space, separator and work name as one single-line phrase, applying ellipsis only at the trailing end of that entire phrase when it does not fit. The Space MUST NOT be separately truncated or allocated a smaller fixed share. The integrated avatar cluster SHALL retain its own space beside both text lines, outside that phrase, and the phrase MUST NOT overlap the actions. The row SHALL
omit any additional visible per-row unseen mark and its reserved slot, while retaining accessible unseen wording; group labels and summary counts SHALL continue to express unseen state. The row SHALL
carry the `data-glide` part names Collie's own rows carry for the dot, the mark and the name.

Collie's own Agent list and card MUST remain unchanged apart from the star port, so every other
surface that renders them is unaffected. The navigation shell MUST NOT add a pin or favourite store,
alter triage classification, change manual Pane fit, or create a separate Agent fetch or backend model.

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
- **THEN** it leads with one 32px Agent mark carrying the ordinal and state at its lower corners, the Space precedes the work's name on the first line in 12px type, and what the Pane is doing follows beneath in 11px type

#### Scenario: More rows than a single key can address
- **WHEN** the rail holds more rows than one keypress can reach
- **THEN** the rows past that limit carry no ordinal, because a badge there would promise a shortcut that does not exist

#### Scenario: Existing Agent behavior evolves
- **WHEN** Collie changes its triage group order or its pinned order in a compatible future update
- **THEN** the rail inherits that group and pinned ordering while Fleet retains its specified within-group timestamp ordering

#### Scenario: Timestamps disagree with placement order
- **WHEN** Recent, Ready or Working contains rows whose timestamps differ from their input placement order
- **THEN** Recent lists the newest last-seen row first and Ready/Working list the newest last-active row first, while group order is unchanged

#### Scenario: Rows share or lack a timestamp
- **WHEN** two rows in a time-ordered group have equal timestamps, and other rows have no timestamp
- **THEN** tied rows keep their input order and untimed rows follow all timed rows in their own input order

#### Scenario: A pinned row has an older timestamp
- **WHEN** a pinned row is older than an unpinned row in its original bucket
- **THEN** it still leads in the native Pinned group and appears nowhere else

#### Scenario: Navigation reads the reordered roster
- **WHEN** the operator cycles next or previous, selects a numbered row, or opens the command bar
- **THEN** those surfaces use the Agent rail's same timestamp-ordered roster

#### Scenario: The combined heading is wider than the row
- **WHEN** the Space and work name together exceed the title area
- **THEN** one trailing ellipsis shortens the combined phrase, with no separate Space ellipsis, while its fixed marks and actions remain visible

#### Scenario: A Ready unseen row is displayed
- **WHEN** an Agent row is finished and unseen
- **THEN** its native status remains visible but no additional visible unseen mark or blank mark slot follows its heading, while the group and summary retain their unseen information


### Requirement: Wide layouts expose independent local sidebars
On a wide viewport (from 80rem) Herdr Fleet SHALL display a local Host → Space → Tab → Pane hierarchy
to the left of the native route column and a local Agent rail to the right. Fleet MUST NOT offer a control that permanently hides a rail that stands at
the current width.

Both rails and their separators SHALL appear together from 80rem at their independent preferred
widths, without an intermediate hierarchy-only layout. At that threshold the route column SHALL
retain at least 392 CSS pixels even when both sidebars are at their maximum supported widths.

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
- **THEN** both rails and separators stand at their preferred widths, exposing Agents without widening the viewport

#### Scenario: The viewport is 96rem wide
- **WHEN** the viewport is at least 96rem
- **THEN** both rails stand at their preferred widths

#### Scenario: Reduced motion is requested
- **WHEN** the browser reports a reduced-motion preference
- **THEN** the shell remains fully operable without non-essential rail, drawer, or overlay transition motion

#### Scenario: Both sidebars have their maximum widths at the desktop threshold
- **WHEN** the viewport is 1280 CSS pixels and both sidebars have their maximum supported widths
- **THEN** the route column retains at least 392 CSS pixels

## ADDED Requirements

### Requirement: Fleet sidebar names describe panes rather than their tabs
Hierarchy leaves and Agent rows SHALL prefer a meaningful pane label, session name or current terminal title over tab labels. Presentation SHALL strip leading non-letter/non-number decorations, remove Codex pipe-delimited directory suffixes and Action Required fragments, and reject positional labels, paths, user-at-host prompts and program-only names. Empty or stale titles SHALL fall back to program and final working-directory component. Filtering MUST NOT rename terminals or alter binding identity, targets or actions.

#### Scenario: A named Tab contains one pane
- **WHEN** the pane has a meaningful title different from the Tab name
- **THEN** the elided hierarchy row and Agent row show the filtered pane title

#### Scenario: A title supplies no work name
- **WHEN** its candidate titles are generic, stale, paths or prompts
- **THEN** the row shows the program and directory fallback rather than the Tab label

## REMOVED Requirements

### Requirement: Todoist shares the right navigation surface
**Reason**: Todoist was retired in 4.0.0; the sidebar specification must not require its former surface.
**Migration**: Keep shared tags/bindings and operator data; use the Agent rail.
