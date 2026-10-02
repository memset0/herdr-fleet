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

### Requirement: Both rails present every host in the pack
The hierarchy rail SHALL present one Host item per member the snapshot reports, each collapsible on
its own and each over that member's own Space, Tab and Pane rows. The Agent rail SHALL present the
Agent rows of every member, not only the member the current address belongs to.

The rails are the fleet's map, not a view of the dashboard. A machine the dashboard hides on this
device, the dashboard tab or workspace filter chosen on it, and the order this device chose for
Collie's pane switcher (by place, by activity, or by which prompt cache goes cold first) SHALL NOT
change which hosts and rows the rails present or their order; those choices stay the dashboard's and
the switcher's own. A pin is the one device choice the rails honour, and only as the Agent rail's
Pinned group states, because the rail's star is Collie's own pin.

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

#### Scenario: The dashboard hides a machine
- **WHEN** the operator turns off a machine's dashboard visibility or picks a dashboard tab on this device
- **THEN** both rails still present that machine and its rows, in the same order as before

#### Scenario: The pane switcher's order changes
- **WHEN** the operator sets the pane order to activity or to cache expiry, from the switcher or from Settings
- **THEN** both rails present the same hosts and rows in the same order as before

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
