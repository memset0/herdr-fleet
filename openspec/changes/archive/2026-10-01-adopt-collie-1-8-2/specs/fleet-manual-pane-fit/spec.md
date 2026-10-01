## MODIFIED Requirements

### Requirement: Display Settings exposes one explicit manual fit action
An authorised operator viewing an active Herdr Pane SHALL see a `Resize` action immediately below
`Text size` in native Display Settings. The row SHALL carry a visible `Custom` badge identifying the
downstream extension. The action MUST be absent or unavailable when the multiplexer of the machine the
Pane is on does not support the capability, the Pane is unavailable, or the client is read-only.

Which machine answers is the adopted Collie's per-host capability rule: a member's own reported
capability decides for that member's Panes, and a member that reports nothing is answered by the
lead's declaration, exactly as Collie answers every other capability. Fleet SHALL NOT decide it from
the lead's multiplexer for a Pane that lives elsewhere.

Activating the action SHALL issue one resize attempt and report success or failure through Collie's
existing status surface. It MUST NOT navigate, close the settings surface, change a display
preference, or trigger from a render/effect without an explicit operator activation.

#### Scenario: Operator opens Display Settings on a writable Herdr Pane
- **WHEN** the active Pane supports manual fit and the client may perform writes
- **THEN** `Resize` with a `Custom` badge appears directly below `Text size`

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

### Requirement: Resize uses existing write, session, audit, and lifecycle boundaries
The resize endpoint SHALL remain behind Collie's existing same-origin/session and write-level device
authorisation. It SHALL resolve the Pane within the request's trusted Host/session scope and record
the operation through the existing audit attribution as `pane.resize`.

A RESIZE SHALL REACH THE MACHINE THE PANE IS ON. Where the addressed Host is another crew member, the
request SHALL be forwarded across the crew link, on the crew prefix and protocol the adopted Collie
speaks, and answered by that member's own handler, exactly as every other Pane write is. The lead's
own record of the forward SHALL carry the same audit action the peer's handler writes, so the two
independent logs read against each other without translation.

While the adopted Collie keeps its one release of protocol overlap, the resize route SHALL be carried
by that overlap in both directions like every other forwarded Pane write: a new lead reaches a member
still on the previous protocol through Collie's own fallback, and a member on the new protocol answers
a lead still on the previous one on the previous prefix. The route SHALL be documented in the crew
protocol document, not in the retired one.

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
- **WHEN** a lead on the adopted release fits a Pane on a member that answers only the previous prefix
- **THEN** Collie's own one-release fallback carries the resize, the member's handler performs it, and both machines record `pane.resize`

#### Scenario: The lead still speaks the previous protocol
- **WHEN** a lead on the previous release forwards a resize to a member on the adopted release
- **THEN** the member answers it on the previous prefix through Collie's own overlap and performs the resize

#### Scenario: The member has not been levelled
- **WHEN** the addressed member does not yet answer the resize route
- **THEN** the operator is told the resize did not happen, and nothing is resized anywhere

#### Scenario: A new Pane route is declared
- **WHEN** a Pane route is added to the application's local surface in a declaration of its own
- **THEN** the correspondence check fails until that route is either federated or deliberately excluded
