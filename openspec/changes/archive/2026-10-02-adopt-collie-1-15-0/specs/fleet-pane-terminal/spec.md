## MODIFIED Requirements

### Requirement: One global switch chooses which Pane surface is rendered
The application SHALL offer exactly one operator-controlled switch that selects, for every Pane, the
terminal surface or the existing mirror surface. The switch SHALL default to the mirror surface, SHALL
be stored per browser rather than on any server, and SHALL be recoverable to its default when its
stored value is absent or unreadable. It MUST NOT be settable per Pane, per Host, or by a link.

The switch MAY be reachable from more than one place, and every such control SHALL read and write
that one stored value rather than holding a copy: a control that could disagree with another about
which surface is selected would be a second switch. At least one of them SHALL stand in the
application's persistent navigation, so the surface can be changed from wherever the operator is
rather than by navigating away from the Pane the choice is about.

While the switch selects the mirror, the Pane's existing route, loader, data, polling, mirror,
composer and every surface around them SHALL behave exactly as they do without this capability, and
no terminal connection, process, or session SHALL be created. That includes the adopted Collie's own
choice of body: where this browser has opted into Collie's Chat body and chosen it, the Pane is drawn
as Chat exactly as Collie draws it.

While the switch selects the terminal, the Pane's address SHALL be unchanged, the application's
persistent navigation rails and header SHALL be rendered as they are for every other route, and the
Pane's mirror text SHALL NOT be requested. The in-Pane tab and Pane strips MAY be omitted from the
terminal surface. The terminal surface SHALL replace whichever body Collie would otherwise draw — the
mirror or Chat — so while it is selected Collie's Chat switch SHALL NOT be offered on the Pane and the
Pane's session SHALL NOT be read for a Chat body. Collie's stored body choice SHALL be left unchanged,
and applies again once the switch selects the mirror.

#### Scenario: The switch is at its default
- **WHEN** an operator opens a Pane in a browser that has never set the switch
- **THEN** the existing mirror surface renders unchanged and no terminal connection is opened

#### Scenario: The switch selects the terminal
- **WHEN** the switch is on and the operator opens any Pane
- **THEN** that Pane's address is unchanged, the rails and header render as on every other route, the terminal surface replaces the mirror and composer, and the Pane's mirror text is not fetched

#### Scenario: Chat is Collie's chosen body while the switch selects the terminal
- **WHEN** this browser has opted into Collie's Chat body and chosen it, and the switch selects the terminal
- **THEN** the terminal surface is drawn, the Pane offers no Chat switch, no Chat session read is made, and the stored Chat choice is unchanged

#### Scenario: Chat is Collie's chosen body while the switch selects the mirror
- **WHEN** this browser has opted into Collie's Chat body and chosen it, and the switch selects the mirror
- **THEN** the Pane is drawn as Collie's Chat body with Collie's own switch, exactly as without this capability

#### Scenario: The switch is changed from the navigation
- **WHEN** the operator changes the surface from the control in the persistent navigation
- **THEN** every Pane is drawn as the chosen surface, and every other control for that switch shows the same choice

#### Scenario: The stored switch value is unreadable
- **WHEN** the browser's stored preference is missing, corrupt, or inaccessible
- **THEN** the application renders the mirror surface and does not fail the route

#### Scenario: A link attempts to select a surface
- **WHEN** a Pane is opened through a link, a restored session, or a navigation that carries surface selection in its address or state
- **THEN** the selection is ignored and the switch's own stored value decides the surface
