## MODIFIED Requirements

### Requirement: Display Settings exposes one explicit manual fit action
An authorised operator viewing an active Herdr Pane SHALL see a `Resize` action immediately below
`Text size` in native Display Settings. The row SHALL carry a visible `Custom` badge identifying the
downstream extension. The action MUST be absent or unavailable when the active multiplexer does not
support the capability, the Pane is unavailable, or the client is read-only.

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
- **WHEN** the active multiplexer does not advertise manual Pane fit
- **THEN** the action is absent and no speculative request is made

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
