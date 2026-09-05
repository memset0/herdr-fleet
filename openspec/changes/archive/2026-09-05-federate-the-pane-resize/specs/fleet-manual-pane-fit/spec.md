## MODIFIED Requirements

### Requirement: Resize uses existing write, session, audit, and lifecycle boundaries
The resize endpoint SHALL remain behind Collie's existing same-origin/session and write-level device
authorisation. It SHALL resolve the Pane within the request's trusted Host/session scope and record
the operation through the existing audit attribution as `pane.resize`.

A RESIZE SHALL REACH THE MACHINE THE PANE IS ON. Where the addressed Host is another pack member, the
request SHALL be forwarded across the pack link and answered by that member's own handler, exactly as
every other Pane write is. The lead's own record of the forward SHALL carry the same audit action the
peer's handler writes, so the two independent logs read against each other without translation.

A member that does not yet answer the route SHALL refuse it, and the refusal SHALL be reported as an
ordinary unsuccessful resize rather than as a resize that happened.

The correspondence between the routes the application serves locally and the routes the pack link
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
- **WHEN** the operator fits a Pane whose Host is another pack member
- **THEN** the request is forwarded to that member, its own handler performs the resize, and both machines record `pane.resize`

#### Scenario: The member has not been levelled
- **WHEN** the addressed member does not yet answer the resize route
- **THEN** the operator is told the resize did not happen, and nothing is resized anywhere

#### Scenario: A new Pane route is declared
- **WHEN** a Pane route is added to the application's local surface in a declaration of its own
- **THEN** the correspondence check fails until that route is either federated or deliberately excluded

