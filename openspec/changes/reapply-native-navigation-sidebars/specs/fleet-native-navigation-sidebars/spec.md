## Purpose

Restores a persistent, responsive native navigation shell around Collie's existing route content
without adding a second router, data source, backend contract, or framed application surface.

## ADDED Requirements

### Requirement: Native route content remains inside one persistent shell
Herdr Fleet SHALL mount one root navigation shell around Collie's existing native route outlet. The
shell and its desktop rails MUST remain mounted while the browser navigates among Home, Space, and
Pane routes. Existing route components, loaders, polling, mutation behavior, and Pane-page controls
MUST remain the content of the native outlet.

The shell MUST NOT use an iframe, `postMessage`, frame cache, duplicate router, alternate Gateway
model, or additional snapshot request. It MUST NOT repurpose the Pane page's existing thread
switcher as the desktop Agent rail.

#### Scenario: Operator navigates from Home to a Pane
- **WHEN** the operator follows native Space or Pane navigation inside the application
- **THEN** the center outlet changes through the existing router while the same root shell and applicable rails remain mounted

#### Scenario: Shell data is refreshed
- **WHEN** the existing root loader or poll supplies a new snapshot
- **THEN** the shell updates from that data without issuing its own snapshot request

#### Scenario: Pane route remains native
- **WHEN** the operator opens a Pane
- **THEN** the existing Pane route, composer, strips, actions, manual fit, and thread switcher remain native outlet content without a framed copy

### Requirement: Wide layouts expose independent local sidebars
On a wide viewport, Herdr Fleet SHALL display a local Space → Tab → Pane hierarchy to the left of
the native route outlet and a local Agent rail to the right. Each sidebar SHALL have an independent
preferred width and collapsed state. Its separator SHALL be pointer-draggable and keyboard
operable, SHALL expose separator semantics and current bounds, and SHALL clamp width to defined
minimum and maximum values.

Collapsing a sidebar MUST preserve its preferred expanded width. Restoring it MUST reuse that
preferred width within the current bounds. Collapsed descendants MUST be inert and hidden from the
accessibility tree rather than remaining keyboard reachable. Reduced-motion preference MUST remove
non-essential sidebar and overlay animation.

#### Scenario: Operator resizes the hierarchy sidebar with a keyboard
- **WHEN** focus is on the left separator and the operator uses its supported arrow or boundary keys
- **THEN** the left width changes within its bounds without changing the right width or route

#### Scenario: Operator collapses and restores a sidebar
- **WHEN** the operator collapses an expanded sidebar and later restores it
- **THEN** its descendants are unavailable while collapsed and it returns at its prior bounded preferred width

#### Scenario: Reduced motion is requested
- **WHEN** the browser reports a reduced-motion preference
- **THEN** the shell remains fully operable without non-essential rail, drawer, or overlay transition motion

### Requirement: Responsive navigation surfaces are mutually exclusive and focus-safe
Below the wide-layout threshold, Herdr Fleet SHALL keep the existing route content native and expose
the hierarchy and Agent list through two local overlay triggers. At most one overlay MAY be open.
Opening either surface SHALL close the other. A closed surface and its descendants MUST be inert and
hidden from the accessibility tree.

Closing an overlay through its close control, backdrop, Escape key, or completed navigation SHALL
restore focus to the trigger that opened it when that trigger remains available. Overlay controls
and hierarchy rows MUST be operable by keyboard.

#### Scenario: Agent overlay replaces an open hierarchy drawer
- **WHEN** the hierarchy drawer is open and the operator opens the Agent overlay
- **THEN** the hierarchy becomes inactive before the Agent overlay becomes active and only one overlay is exposed to assistive technology

#### Scenario: Operator closes with Escape
- **WHEN** keyboard focus is within an open overlay and the operator presses Escape
- **THEN** the overlay closes and focus returns to its opening trigger

#### Scenario: Operator navigates from the hierarchy
- **WHEN** a hierarchy Space or Pane row activates a native route
- **THEN** the responsive hierarchy surface closes, the native outlet navigates, and focus is not left inside hidden content

### Requirement: Hierarchy is derived locally and follows native routes
The hierarchy SHALL derive its Space, Tab, and Pane structure only from the current root snapshot's
local workspaces, tabs, Agent panes, and shell panes. Space activation SHALL use Collie's existing
Space route, and Pane activation SHALL use Collie's existing Pane route and scope rules. Disclosure
actions MUST only change browser-local presentation state and MUST NOT navigate, mutate a Pane,
refresh, revalidate, or issue an API request.

The active Pane row SHALL be highlighted. Its Space and Tab ancestors SHALL automatically become
disclosed whenever the selected Pane changes, including direct and history-based navigation.
Operator disclosure choices for unrelated branches SHALL remain independent.

The first implementation MUST NOT render Host rows or claim Pack support. A future Host-aware data
source or identity extension MAY add an outer level, but MUST preserve this native shell and the
Space → Tab → Pane behavior within a Host.

#### Scenario: A Pane deep link becomes active
- **WHEN** the current route selects a Pane whose Space or Tab is closed in stored disclosure state
- **THEN** that Pane is highlighted and its Space and Tab ancestry is disclosed without a request

#### Scenario: Operator toggles an unrelated Space
- **WHEN** the operator expands or collapses a Space that does not contain the selected Pane
- **THEN** only local disclosure state changes and no navigation, revalidation, or API request occurs

#### Scenario: A shell Pane is present
- **WHEN** the existing root snapshot contains a local shell Pane
- **THEN** the Pane appears under its existing Space and Tab and activates through the same native Pane path without becoming an Agent

### Requirement: Agent rail reuses native Agent behavior
The desktop Agent rail and responsive Agent overlay SHALL render the existing shared native Agent
list from the current root snapshot. They SHALL preserve its favorite-aware ordering, triage
sections, card behavior, row navigation, favorite controls, and browser-local favorite semantics.
Shell rows MUST NOT be introduced into the Agent rail.

The navigation shell MUST NOT redesign Agent cards, add another favorite store, alter triage,
change manual Pane fit, or create a separate Agent fetch or backend model.

#### Scenario: Favorites change while the Agent rail is visible
- **WHEN** the operator toggles an existing native Agent favorite control
- **THEN** the shared Agent list updates with its current favorite-aware ordering and the shell adds no navigation or request behavior

#### Scenario: Operator opens an Agent from the responsive overlay
- **WHEN** the operator activates an Agent row in the responsive Agent overlay
- **THEN** Collie's existing Pane navigation runs once and the overlay closes

#### Scenario: Existing Agent behavior evolves
- **WHEN** the shared Agent list changes its native ordering or card presentation in a compatible future update
- **THEN** both shell Agent surfaces inherit that behavior rather than maintaining a duplicate implementation

### Requirement: Navigation preferences are bounded and fail safe
Sidebar preferred widths, collapsed states, and hierarchy disclosure state SHALL be independent,
versioned browser-local preferences with explicit byte, entry-count, identifier-length, and width
bounds. Unknown versions, malformed values, oversized records, duplicate disclosure identities,
unavailable storage, and read or write exceptions MUST leave the native application usable with
safe bounded defaults or bounded in-memory continuity.

Preferences MUST NOT be sent to the Gateway, Collie bridge, Herdr, or another browser. They MUST
NOT contain Pane output, credentials, private configuration, or deployment identity.

#### Scenario: Stored preferences are valid
- **WHEN** the application starts with a supported bounded preference record
- **THEN** independent sidebar widths, collapsed states, and disclosure choices are restored locally

#### Scenario: Stored preferences are invalid
- **WHEN** the record is malformed, unsupported, oversized, duplicated, or outside a defined bound
- **THEN** the shell uses safe bounded defaults and performs no recovery request

#### Scenario: A preference write fails
- **WHEN** browser storage rejects a width, collapse, or disclosure update
- **THEN** the current page keeps a bounded in-memory result and all native navigation remains usable
