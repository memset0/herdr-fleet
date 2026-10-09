# fleet-manual-pane-fit Specification

## Purpose

Adds one explicit, authorised action that fits a Herdr Pane's shared PTY width to the native Collie
terminal mirror without introducing automatic resize or controller takeover.

## Requirements

### Requirement: Display Settings exposes one explicit manual fit action
An authorised operator viewing an active Herdr Pane SHALL see a `Resize` action immediately below
`Text size` among the terminal mirror's rows of native Display Settings. The row SHALL carry a visible
`Custom` badge identifying the downstream extension. The action MUST be unavailable when the Pane's
Host has no usable terminal endpoint, the Pane is unavailable, or the client is read-only, and MUST be
absent when no Fleet Gateway answers for the deployment.

Native Display Settings answers for the body on screen. Resize fits the shared PTY to the terminal
mirror, so it SHALL be one of the mirror's rows only: while the Pane is drawn as Collie's Chat body,
whose rows are Chat's own, the action SHALL be absent, and it SHALL return with the mirror's rows when
the Pane is drawn as the mirror again.

Which Hosts can fit is decided by Fleet, not by Collie's multiplexer capability table: the lead can
when it can run the multiplexer's own command locally, and a member can when the lead's validated
configuration declares a terminal endpoint for it. A member without one SHALL show the action as
unavailable. The browser SHALL learn this from one Fleet Gateway read and SHALL NOT infer it from the
lead's multiplexer for a Pane that lives elsewhere.

Activating the action SHALL issue one resize attempt and report success or failure through Collie's
existing status surface. It MUST NOT navigate, close the settings surface, change a display
preference, or trigger from a render/effect without an explicit operator activation. A read-only client
SHALL see the action disabled in the browser.

#### Scenario: Operator opens Display Settings on a writable Herdr Pane
- **WHEN** the Pane's Host can fit, the client may perform writes, and the Pane is drawn as the terminal mirror
- **THEN** `Resize` with a `Custom` badge appears directly below `Text size`

#### Scenario: The Pane is drawn as Chat
- **WHEN** the operator opens Display Settings on a Pane drawn as Collie's Chat body
- **THEN** no `Resize` action and no `Custom` badge appear, and no resize request is made

#### Scenario: Operator activates Resize
- **WHEN** the operator activates the available action once
- **THEN** exactly one resize request is sent and the result is reported without changing route or display preferences

#### Scenario: The client is read-only
- **WHEN** the active device lacks write authorisation
- **THEN** the manual fit action is shown disabled and no request is made

#### Scenario: A member has no terminal endpoint
- **WHEN** the Pane lives on a member for which the lead declares no terminal endpoint
- **THEN** the row is shown unavailable and no speculative request is made

#### Scenario: No Fleet Gateway answers
- **WHEN** the application runs without a Fleet Gateway in front of it
- **THEN** no `Resize` row appears

#### Scenario: The multiplexer is unsupported
- **WHEN** the Pane's Host cannot run the multiplexer's own fit command
- **THEN** the row is shown unavailable and no speculative request is made

#### Scenario: A member runs a different multiplexer from the lead
- **WHEN** the lead's own multiplexer could fit and the Pane lives on a member
- **THEN** the lead's capability is not consulted; the member's declared terminal endpoint decides

#### Scenario: A member reports no capabilities
- **WHEN** the Pane's member reports no capability table to Collie
- **THEN** availability is unaffected, because Fleet never reads that table for the fit

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
The resize operation SHALL accept only an integer column count in the range 20 through 500. The
machine the Pane lives on SHALL resolve the Pane and its current viewport row count from its own local
multiplexer server, never from browser-supplied paths or row values, and SHALL preserve that row count
while changing columns. Resolution SHALL require exactly one live Pane matching the id and SHALL NOT
fall back to another Pane.

That machine SHALL retain and reuse one controller for each local multiplexer socket and Pane, because
a controller's size does not persist once it is released. It MUST NOT request takeover of another
client. Acquisition conflict, missing viewport rows, an absent Pane, invalid input, controller exit,
and resize failure MUST be surfaced without claiming success or changing another owner's attachment.

The retained controller SHALL be released when its Pane goes away and when the Gateway or the peer
terminal service stops, without killing an unrelated process by name, port, or pidfile. A controller
displaced by another client SHALL be forgotten, and the next request SHALL acquire a fresh one or
report the conflict.

#### Scenario: Resize succeeds
- **WHEN** an authorised request supplies valid columns for a live Pane with known viewport rows
- **THEN** the retained controller resizes to those columns and the existing row count exactly once

#### Scenario: Another controller owns the Pane
- **WHEN** the multiplexer refuses controller acquisition because another client is attached
- **THEN** a conflict is reported, no takeover is requested, and the existing attachment is left intact

#### Scenario: Viewport rows are unavailable
- **WHEN** the local multiplexer cannot provide a positive current viewport row count for the Pane
- **THEN** the resize fails before controller acquisition rather than guessing a height

#### Scenario: The same Pane is resized again
- **WHEN** a later valid manual request targets the same socket and Pane
- **THEN** the retained controller is reused and only the new explicit dimensions are applied

#### Scenario: The Pane closes
- **WHEN** a Pane with a retained controller is closed
- **THEN** its controller ends and is no longer retained

### Requirement: Resize is served by the Fleet Gateway and the Pane's own machine
The Fleet Gateway SHALL serve `POST /fleet/api/pane/:id/resize` with a JSON body containing exactly
`cols`, scoped by the same optional Host and session parameters the terminal route accepts and nothing
else. It SHALL require an active Gateway session and SHALL apply the Gateway's same-origin rule for
unsafe methods; an unauthenticated request SHALL receive the Gateway's machine-surface refusal rather
than a redirect. Each attempt SHALL be recorded as one Gateway diagnostic line naming the Pane, its
Host, the requested columns and the outcome, and never a terminal id or session id.

A lead Pane SHALL be resized on the lead. A member's Pane SHALL be resized by that member's own
terminal service, reached over the lead's existing projection of that service. Resize MUST NOT add a
crew-link route or field and MUST NOT dial a multiplexer socket across a machine boundary. A member
whose terminal service is unreachable, or that does not answer the operation, SHALL produce an ordinary
unsuccessful resize. Collie's own bridge and crew link SHALL NOT serve a resize route.

#### Scenario: An unauthenticated client requests resize
- **WHEN** a request without an active Gateway session reaches the route
- **THEN** it receives the Gateway's authentication refusal and nothing is resized

#### Scenario: A cross-origin request
- **WHEN** an authenticated request arrives with a foreign or missing Origin
- **THEN** the Gateway refuses it before any Pane is resolved

#### Scenario: A body or query carries extra fields
- **WHEN** the body carries a field other than `cols`, or the query carries a parameter other than Host and session
- **THEN** the request is refused and nothing is resized

#### Scenario: A lead Pane is resized
- **WHEN** the operator fits a Pane on the lead
- **THEN** the lead resolves it locally, resizes it through its own retained controller, and writes one diagnostic line

#### Scenario: A member's Pane is resized
- **WHEN** the operator fits a Pane whose Host is a member with a terminal endpoint
- **THEN** the lead asks that member's terminal service, the member resolves and resizes its own Pane, and nothing crosses the crew link

#### Scenario: The member has not been levelled
- **WHEN** the member's terminal service does not answer the resize operation
- **THEN** the operator is told the resize did not happen, and nothing is resized anywhere

#### Scenario: Collie is asked directly
- **WHEN** a client calls Collie's former `/api/pane/:id/resize` or `/crew/v1/pane/:id/resize`
- **THEN** no resize route answers it
