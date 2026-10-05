# fleet-agent-favorites Specification

## Purpose

Makes the fork's star on native Agent rows a second entry point to Collie's own per-device pins, and
migrates the retired browser-local favourites into them once, while preserving Collie's triage,
routing, polling, and backend behavior.

## Requirements

### Requirement: Agent favorites use stable browser-local identity
Herdr Fleet SHALL keep no favourite state of its own. A "favourite" is the adopted Collie's own
per-device pin: the star a row carries reads and writes Collie's pin store, so pinning from the star
and pinning from Collie's own hold or actions sheet are one mechanism with two entry points. Pin
identity, bounds, dormancy and pruning are Collie's, unchanged.

The star SHALL be pressed exactly when Collie would list the row in its Pinned group. Nothing Fleet
does MAY send pin state to the Gateway, Collie bridge, Herdr, or another browser.

#### Scenario: Agent presentation changes
- **WHEN** a pinned Agent changes status, timestamps, labels, cwd, focus, reachability, or cache source while its row and workspace stay the same
- **THEN** its star stays pressed, because the pin is Collie's and Collie's identity has not changed

#### Scenario: Pane identity is reused by another implementation
- **WHEN** the same Host/session/Pane later reports a different Agent implementation in the same workspace
- **THEN** the star follows Collie's pin identity, which is the row and its workspace, and Fleet adds no identity rule of its own

#### Scenario: The same pane id appears in another scope
- **WHEN** two Agent rows share a Pane id but differ by Host or Herdr session
- **THEN** each row's star reflects its own pin, because Collie's row identity includes Host and session

#### Scenario: Browser storage cannot be used
- **WHEN** browser storage throws or holds an unreadable pin record
- **THEN** the star still toggles Collie's in-memory pin state for the page and Fleet performs no network recovery

#### Scenario: A pane is pinned from Collie's own sheet
- **WHEN** the operator pins a pane from Collie's actions sheet
- **THEN** that pane's star is pressed on the dashboard and on the Agent rail without any second store being written

#### Scenario: A pane is pinned from the star
- **WHEN** the operator presses an unpressed star
- **THEN** Collie's pin store records the pin, and Collie's own sheet offers Unpin for that pane

#### Scenario: Another browser opens Fleet
- **WHEN** the same Fleet account is opened in a browser that holds no pins
- **THEN** no star is pressed and no pin is inferred from account, Gateway, Collie, or Herdr state

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

### Requirement: Stored favourites become pins once
A browser that still holds the retired Fleet favourite record SHALL have it migrated exactly once:
each stored favourite whose Host, session, Pane and Agent implementation match a live Agent row in a
fresh snapshot SHALL become a Collie pin for that row, and the retired record SHALL then be deleted.
A stored favourite with no matching live row SHALL be dropped, because a pin needs the workspace the
pane sits in and only a live row says that.

The migration MUST NOT run against a stale or empty snapshot, MUST NOT unpin anything, and MUST NOT
send anything to the Gateway, bridge, Herdr or another browser. A malformed, oversized or unreadable
record SHALL be deleted without pinning anything.

#### Scenario: A favourite's pane is live
- **WHEN** the application loads a fresh snapshot in a browser holding a favourite whose pane is listed
- **THEN** that pane is pinned and the retired record no longer exists

#### Scenario: A favourite's pane is gone
- **WHEN** the stored favourite matches no listed Agent
- **THEN** nothing is pinned for it and the retired record is still deleted

#### Scenario: The snapshot is stale
- **WHEN** the snapshot is an error render or lists no Agent
- **THEN** the record is left in place for a later fresh snapshot and nothing is pinned
