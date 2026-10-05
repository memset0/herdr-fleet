## MODIFIED Requirements

### Requirement: Native Agent rows expose an independent favorite control
Every native Agent row rendered by the shared Agent list and by the Agent rail SHALL expose an independent star control with muted ink at rest at no less than 3:1 against the row's ground, a muted hover fill and a press scale. The shared list SHALL retain its existing round icon button. In the wide-layout rail, a smaller star SHALL occupy the top position in a fixed trailing column above the tag action. In compact layouts (phone widths or a touch-operated switcher below the standing Agent-rail breakpoint), favorite and tag actions SHALL share one trailing horizontal row, with favorite first, and each SHALL retain an independent target of at least 44px at default text size. Both layouts SHALL retain smaller glyphs and visible keyboard focus indicators. The row SHALL
reserve the control's width at its trailing end so the row's text never runs under it. Shell rows
MUST NOT expose the control. Activating it SHALL toggle `aria-pressed` and toggle the pane's pin.

Because a pin moves its row into or out of the Pinned group, keyboard focus SHALL follow the control
to the row's new place rather than falling to the document.

Star activation MUST NOT open or focus the Pane, change the current route, invoke the row's
navigation action, submit a terminal action, request a refresh, close a surrounding native
surface, or mutate backend state. The row's existing open action and keyboard semantics MUST remain
available independently from the control.

#### Scenario: Operator favorites an Agent
- **WHEN** the operator activates an unpressed star
- **THEN** it becomes pressed, the pane is pinned, the row is listed in the Pinned group, focus is on that row's star, and no Pane navigation or request occurs

#### Scenario: Operator removes a favorite
- **WHEN** the operator activates a pressed star
- **THEN** it becomes unpressed, the pin is removed, the row returns to its own group, focus is on that row's star, and the Pane is untouched

#### Scenario: Operator opens a favorited row
- **WHEN** the operator activates the row outside its star
- **THEN** Collie's existing Pane-open behavior runs exactly once

#### Scenario: A shell row is rendered
- **WHEN** the native list contains a row whose kind is `shell`
- **THEN** the row retains its existing presentation and has no star

#### Scenario: The rail shows both actions
- **WHEN** an Agent rail row offers pinning and tag editing
- **THEN** noncompact rows stack the star above the tag action and compact rows place them side by side, without either action overlapping text or the other target

#### Scenario: A phone shows both actions
- **WHEN** the Agent card is drawn in compact layouts
- **THEN** both actions remain independently tappable without requiring the card to reserve the height of two vertically stacked touch targets
