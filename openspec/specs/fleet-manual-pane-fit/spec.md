# fleet-manual-pane-fit Specification

## Purpose

Adds one explicit, authorised action that fits a Herdr Pane's shared PTY width to the native Collie
terminal mirror without introducing automatic resize or controller takeover.

## Requirements

### Requirement: Display Settings exposes one explicit manual fit action
An authorised operator viewing an active Herdr Pane SHALL see a `Resize` action immediately below
`Text size` in native Display Settings, and beside it a field for the number of rows to keep on
screen. The row SHALL carry a visible `Custom` badge identifying the downstream extension. Both
controls MUST be absent or unavailable when the active multiplexer does not support the capability,
the Pane is unavailable, or the client is read-only.

Activating the action SHALL issue one resize attempt carrying the measured columns and the chosen
rows, and report success or failure through Collie's existing status surface. A row count typed into
the field SHALL be applied only once it has held still, and only when it differs from the count last
applied, so a decision costs one request and a keystroke costs none. An empty field SHALL mean the
Pane keeps its own height, and clearing the field MUST NOT itself resize anything. The chosen count
SHALL be remembered as a bounded browser-local preference of this device.

Neither control MUST navigate, close the settings surface, change a display preference other than
that count, or trigger from a render or effect without an explicit operator action.

#### Scenario: Operator opens Display Settings on a writable Herdr Pane
- **WHEN** the active Pane supports manual fit and the client may perform writes
- **THEN** `Resize` with a `Custom` badge appears directly below `Text size`, with the rows field beside it

#### Scenario: Operator activates Resize
- **WHEN** the operator activates the available action once
- **THEN** Collie sends exactly one resize request carrying the measured columns and the chosen rows, and reports the result without changing route or display preferences

#### Scenario: Operator types a row count
- **WHEN** the operator types a bounded number and stops
- **THEN** exactly one resize request is sent once the number has held still, and typing a digit and removing it again sends none

#### Scenario: Operator empties the row field
- **WHEN** the field is cleared
- **THEN** no resize is sent and later fits leave the Pane's own height alone

#### Scenario: The client is read-only
- **WHEN** the active device lacks write authorisation
- **THEN** neither control is presented as available and a direct request remains denied by the server write gate

#### Scenario: The multiplexer is unsupported
- **WHEN** the active multiplexer does not advertise manual Pane fit
- **THEN** both controls are absent and no speculative request is made

### Requirement: Manual fit derives bounded columns from current rendered geometry
On explicit activation, Herdr Fleet SHALL measure the active terminal mirror's usable content width
using its current computed monospace cell width and horizontal padding. It SHALL floor the number of
complete cells and clamp the result to a bounded whole-number range of 20 through 500 columns.

Missing, zero, non-finite, or otherwise unusable geometry MUST fail visibly without sending a
resize. Later viewport, drawer, rail, font-size, route, or layout changes MUST NOT issue another
request until the operator activates `Resize` again.

#### Scenario: Current geometry is usable
- **WHEN** the visible content width and monospace cell width produce a finite value
- **THEN** Fleet subtracts horizontal padding, floors complete cells, clamps to 20..500, and sends that integer once

#### Scenario: Geometry cannot be measured
- **WHEN** the scrollport, computed font metrics, padding, or usable width is unavailable or invalid
- **THEN** Fleet reports failure and sends no resize request

#### Scenario: Layout changes after resize
- **WHEN** browser size, drawer state, font preference, or native layout changes after a successful fit
- **THEN** no follow-up resize occurs without another explicit activation

### Requirement: Herdr resize preserves rows and controller ownership
The protected resize operation SHALL accept an integer column count in the range 20 through 500, and
MAY accept an integer row count beside it. A supplied row count SHALL be validated by the same rule
the controller applies and MUST be refused otherwise; no other field is accepted. When no row count
is supplied, the operation SHALL obtain the current Pane viewport row count from server-owned state
and preserve it, never from a browser-supplied path.

The trusted Herdr session socket SHALL always come from server-owned state, never from the request.

Herdr Fleet SHALL retain and reuse one controller lease for each trusted session socket and Pane.
It MUST NOT request takeover of another controller. Acquisition conflict, missing viewport rows,
unsupported multiplexer, invalid input, controller exit, and resize failure MUST be surfaced without
claiming success or changing another owner's controller.

#### Scenario: Resize succeeds
- **WHEN** an authorised request supplies valid columns for a live Herdr Pane with known viewport rows
- **THEN** the retained controller resizes to those columns and the existing row count exactly once

#### Scenario: Resize carries an explicit height
- **WHEN** an authorised request supplies valid columns and a valid row count
- **THEN** the controller resizes to exactly that pair and the Pane's previous height is not consulted

#### Scenario: The request names an out-of-range height
- **WHEN** a request supplies a row count the controller would refuse
- **THEN** the request is rejected before controller acquisition and nothing is resized

#### Scenario: Another controller owns the Pane
- **WHEN** Herdr refuses controller acquisition because another client owns it
- **THEN** Fleet reports the conflict, does not use takeover, and leaves existing ownership intact

#### Scenario: Viewport rows are unavailable
- **WHEN** no row count was supplied and server-owned Pane state cannot provide a positive current viewport row count
- **THEN** the resize fails before controller acquisition rather than guessing a height

#### Scenario: The same Pane is resized again
- **WHEN** a later valid manual request targets the same trusted session socket and Pane
- **THEN** Fleet reuses its retained controller lease and applies only the new explicit dimensions

### Requirement: Resize uses existing write, session, audit, and lifecycle boundaries
The resize endpoint SHALL remain behind Collie's existing same-origin/session and write-level device
authorisation. It SHALL resolve the Pane within the request's trusted Host/session scope and record
the operation through the existing audit attribution as `pane.resize`.

Only the Herdr adapter SHALL advertise the capability. Stale or unsupported clients MUST receive a
clean unsupported response. All retained controllers MUST be released when their Pane/session/server
closes or when the bridge shuts down, without killing an unrelated process by name, port, or pidfile.

#### Scenario: An unauthorised client requests resize
- **WHEN** the existing write gate rejects the request
- **THEN** no controller is acquired and the standard denial response is returned

#### Scenario: A stale client calls an unsupported bridge
- **WHEN** the active adapter does not advertise manual fit
- **THEN** the endpoint reports unsupported and performs no resize

#### Scenario: The bridge shuts down
- **WHEN** Collie closes while manual-fit controllers are retained
- **THEN** Fleet releases every owned controller and leaves unrelated Herdr clients and Panes untouched
