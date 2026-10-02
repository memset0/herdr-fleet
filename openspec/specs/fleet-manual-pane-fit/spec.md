# fleet-manual-pane-fit Specification

## Purpose

Adds one explicit, authorised action that fits a Herdr Pane's shared PTY width to the native Collie
terminal mirror without introducing automatic resize or controller takeover.

## Requirements

### Requirement: Display Settings exposes one explicit manual fit action
An authorised operator viewing an active Herdr Pane SHALL see a `Resize` action immediately below
`Text size` among the terminal mirror's rows of native Display Settings. The row SHALL carry a visible
`Custom` badge identifying the downstream extension. The action MUST be absent or unavailable when the
multiplexer of the machine the Pane is on does not support the capability, the Pane is unavailable, or
the client is read-only.

Native Display Settings answers for the body on screen. Resize fits the shared PTY to the terminal
mirror, so it SHALL be one of the mirror's rows only: while the Pane is drawn as Collie's Chat body,
whose rows are Chat's own, the action SHALL be absent, and it SHALL return with the mirror's rows when
the Pane is drawn as the mirror again.

Which machine answers is the adopted Collie's per-host capability rule: a member's own reported
capability decides for that member's Panes, and a member that reports nothing is answered by the
lead's declaration, exactly as Collie answers every other capability. Fleet SHALL NOT decide it from
the lead's multiplexer for a Pane that lives elsewhere.

Activating the action SHALL issue one resize attempt and report success or failure through Collie's
existing status surface. It MUST NOT navigate, close the settings surface, change a display
preference, or trigger from a render/effect without an explicit operator activation.

#### Scenario: Operator opens Display Settings on a writable Herdr Pane
- **WHEN** the active Pane supports manual fit, the client may perform writes, and the Pane is drawn as the terminal mirror
- **THEN** `Resize` with a `Custom` badge appears directly below `Text size`

#### Scenario: The Pane is drawn as Chat
- **WHEN** the operator opens Display Settings on a Pane drawn as Collie's Chat body
- **THEN** no `Resize` action and no `Custom` badge appear, and no resize request is made

#### Scenario: Operator activates Resize
- **WHEN** the operator activates the available action once
- **THEN** Collie sends exactly one resize request and reports the result without changing route or display preferences

#### Scenario: The client is read-only
- **WHEN** the active device lacks write authorisation
- **THEN** the manual fit action is not presented as available and a direct request remains denied by the server write gate

#### Scenario: The multiplexer is unsupported
- **WHEN** the multiplexer of the Pane's own machine does not advertise manual Pane fit
- **THEN** the action is absent and no speculative request is made

#### Scenario: A member runs a different multiplexer from the lead
- **WHEN** the lead's multiplexer advertises manual Pane fit and the Pane's member reports a multiplexer that does not, or the reverse
- **THEN** the action follows the member's own answer for that Pane

#### Scenario: A member reports no capabilities
- **WHEN** the Pane's member runs a build that reports no capability table
- **THEN** the lead's declaration decides, as it did before the adoption

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
The protected resize operation SHALL accept only an integer column count in the range 20 through
500. It SHALL obtain the current trusted Herdr session socket and current Pane viewport row count
from server-owned state, never from browser-supplied paths or row values, and SHALL preserve that row
count while changing columns.

Herdr Fleet SHALL retain and reuse one controller lease for each trusted session socket and Pane.
It MUST NOT request takeover of another controller. Acquisition conflict, missing viewport rows,
unsupported multiplexer, invalid input, controller exit, and resize failure MUST be surfaced without
claiming success or changing another owner's controller.

#### Scenario: Resize succeeds
- **WHEN** an authorised request supplies valid columns for a live Herdr Pane with known viewport rows
- **THEN** the retained controller resizes to those columns and the existing row count exactly once

#### Scenario: Another controller owns the Pane
- **WHEN** Herdr refuses controller acquisition because another client owns it
- **THEN** Fleet reports the conflict, does not use takeover, and leaves existing ownership intact

#### Scenario: Viewport rows are unavailable
- **WHEN** server-owned Pane state cannot provide a positive current viewport row count
- **THEN** the resize fails before controller acquisition rather than guessing a height

#### Scenario: The same Pane is resized again
- **WHEN** a later valid manual request targets the same trusted session socket and Pane
- **THEN** Fleet reuses its retained controller lease and applies only the new explicit dimensions

### Requirement: Resize uses existing write, session, audit, and lifecycle boundaries
The resize endpoint SHALL remain behind Collie's existing same-origin/session and write-level device
authorisation. It SHALL resolve the Pane within the request's trusted Host/session scope and record
the operation through the existing audit attribution as `pane.resize`.

A RESIZE SHALL REACH THE MACHINE THE PANE IS ON. Where the addressed Host is another crew member, the
request SHALL be forwarded across the crew link, on the crew prefix and protocol the adopted Collie
speaks, and answered by that member's own handler, exactly as every other Pane write is. The lead's
own record of the forward SHALL carry the same audit action the peer's handler writes, so the two
independent logs read against each other without translation. The route SHALL be documented in the
crew protocol document.

A member that does not yet answer the route SHALL refuse it, and the refusal SHALL be reported as an
ordinary unsuccessful resize rather than as a resize that happened.

The correspondence between the routes the application serves locally and the routes the crew link
carries SHALL be enforced mechanically over EVERY route declaration, not over one of them. A route
declared beside the others MUST NOT be able to reach the local surface while being absent from the
federated one.

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

#### Scenario: A Pane on another member is resized
- **WHEN** the operator fits a Pane whose Host is another crew member
- **THEN** the request is forwarded to that member on the crew link, its own handler performs the resize, and both machines record `pane.resize`

#### Scenario: The member still speaks the previous protocol
- **WHEN** a lead on the adopted release fits a Pane on a member whose release shares no crew protocol version with it
- **THEN** Collie refuses the forward as it refuses every write to an incompatible member, the operator is told the resize did not happen, and Fleet adds no fallback

#### Scenario: The lead still speaks the previous protocol
- **WHEN** a lead on this product's previous release forwards a resize to a member on the adopted release, both speaking the same crew protocol version
- **THEN** the member answers it on the crew prefix, its handler performs the resize, and both machines record `pane.resize`

#### Scenario: The member has not been levelled
- **WHEN** the addressed member does not yet answer the resize route
- **THEN** the operator is told the resize did not happen, and nothing is resized anywhere

#### Scenario: A new Pane route is declared
- **WHEN** a Pane route is added to the application's local surface in a declaration of its own
- **THEN** the correspondence check fails until that route is either federated or deliberately excluded
