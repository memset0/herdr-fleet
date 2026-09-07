## ADDED Requirements

### Requirement: A peer's terminal attachment takes over an external attachment
When a peer starts the terminal server for a validated Pane request, its fixed Herdr attach command
SHALL request automatic takeover of an external attachment to that resolved terminal. The peer SHALL
use the same takeover policy as the lead, with no request-controlled flag, extra setting, or operator
confirmation. The external attachment is intentionally disconnected; the Pane and its running program
SHALL remain alive.

This policy SHALL preserve local-only Pane resolution, executable identity verification, the fixed
request grammar, owner-protected endpoints, and the terminal server's one-client limit. It MUST NOT
allow the lead to name an executable, command argument, terminal id, socket path, or account. It
SHALL NOT make a second Fleet browser displace the first: the Gateway's single-session and
single-browser rules continue to govern both local and peer placements.

#### Scenario: A peer terminal is held externally
- **WHEN** a validated request selects a peer's Pane whose resolved terminal already has an external Herdr attachment
- **THEN** the peer's fixed attach command takes over that attachment and serves the same terminal without terminating its Pane or program

#### Scenario: The lead attempts to select takeover behavior
- **WHEN** a peer request includes an extra takeover flag or any execution argument
- **THEN** the existing exact grammar refuses the request before starting a terminal server

#### Scenario: Two browsers request the same peer Pane
- **WHEN** two admitted browsers request one peer placement through the Gateway
- **THEN** they share Gateway establishment and only one browser attaches, without starting a second peer terminal server for that Gateway attempt
