## MODIFIED Requirements

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
