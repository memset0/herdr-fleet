## MODIFIED Requirements

### Requirement: Wide layouts expose independent local sidebars
On a wide viewport (from 80rem) Herdr Fleet SHALL display a local Host → Space → Tab → Pane hierarchy
to the left of the native route column and a local Agent/Todoist rail to the right. Fleet MUST NOT offer a control that permanently hides a rail that stands at
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
- **THEN** both rails and separators stand at their preferred widths, exposing Agents and Todoist without widening the viewport

#### Scenario: The viewport is 96rem wide
- **WHEN** the viewport is at least 96rem
- **THEN** both rails stand at their preferred widths

#### Scenario: Reduced motion is requested
- **WHEN** the browser reports a reduced-motion preference
- **THEN** the shell remains fully operable without non-essential rail, drawer, or overlay transition motion

#### Scenario: Both sidebars have their maximum widths at the desktop threshold
- **WHEN** the viewport is 1280 CSS pixels and both sidebars have their maximum supported widths
- **THEN** the route column retains at least 392 CSS pixels

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
- **WHEN** the viewport reaches the desktop rail threshold
- **THEN** the hierarchy rail never stands alone: the Agent/Todoist rail and both separators appear at the same threshold

