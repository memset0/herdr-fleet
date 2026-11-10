# fleet-core-runtime Specification

## Purpose

Let Fleet serve the terminals used by Herdr App through herdr-core while preserving authentication, exact local resolution and existing terminal processes.

## Requirements

### Requirement: Core selection is explicit and independent of the TUI
Fleet SHALL support explicitly selected Core-backed standalone execution with a validated local Core session or socket. The Collie child, terminal surface and manual fit SHALL select the same backend and endpoint. An unavailable Core MUST be reported unavailable without falling back to a TUI, another session or another machine. Core mode MUST require no TUI executable, plugin registry or TUI server. Existing upstream TUI support SHALL remain separate.

#### Scenario: Both products exist
- **WHEN** a Core deployment starts on a machine that also has the older TUI installed
- **THEN** all local Fleet surfaces use only the selected Core and no TUI plugin command is invoked

#### Scenario: The selected Core is absent
- **WHEN** the configured Core endpoint cannot be reached
- **THEN** Fleet reports that endpoint unavailable and does not start or select a replacement terminal runtime

### Requirement: Core terminal access is resolved on its own machine
The machine owning a pane SHALL resolve it against exactly one live local Core terminal. Remote addresses, missing, ambiguous and finished terminals MUST be refused without guessing. Browser input MUST NOT supply a socket, executable, command, remote target or raw attachment selector. Existing Gateway authentication, origin checks, peer loopback projections and browser exclusivity SHALL continue to govern terminal and fit requests. A fit SHALL preserve the terminal's current rows and change only explicitly requested bounded columns; no polling or rendering SHALL resize a terminal.

#### Scenario: Equal terminal addresses on different machines
- **WHEN** the lead and a member both have a terminal named t1
- **THEN** each resolves only its own terminal and the lead forwards a member pane through its existing terminal-service projection

#### Scenario: A browser supplies an attachment override
- **WHEN** a terminal or resize request includes a socket, command or raw selector
- **THEN** it is refused before opening a Core connection

#### Scenario: Another browser owns the terminal surface
- **WHEN** a second browser requests that placement
- **THEN** it is refused as busy unless the operator explicitly activates the existing browser takeover control

### Requirement: Core associations are scoped by permanent runtime identity
Core-backed associations SHALL distinguish permanent Core identity, session and terminal identity, independently of client aliases, endpoint paths and layout. Old TUI associations MUST NOT attach to a similarly named Core terminal. Unresolved old associations SHALL remain recoverable without guessed conversion.

#### Scenario: A client alias changes
- **WHEN** the same permanent Core and terminal are reached through a different client alias
- **THEN** existing Core associations still resolve to that terminal

#### Scenario: A replacement Core reuses an address
- **WHEN** a different permanent Core has a terminal with the same local address
- **THEN** it inherits no associations from the previous Core or from the older TUI

### Requirement: Migration preserves processes and makes rollback explicit
Core migration SHALL verify the selected Core's identity and actual screen/terminal access before switching Fleet. It SHALL preserve browser credentials, pairing and crew authority, settings and association stores. Restarting Fleet MUST NOT terminate Core or TUI terminal processes. The old Fleet generation and configuration SHALL remain recoverable until the replacement passes its acceptance checks. Existing TUI installations or sessions MUST NOT be removed implicitly. A migration that changes operator configuration or lifecycle SHALL be declared a major release and SHALL follow the owner's manual major-release gate.

#### Scenario: The replacement does not become healthy
- **WHEN** the Core-backed Fleet fails its readiness or authenticated access checks
- **THEN** the previous Fleet generation can be restored without terminating either terminal runtime or discarding operator state

#### Scenario: Source checks pass before deployment
- **WHEN** source tests pass but the selected Core deployment has not been exercised
- **THEN** the migration remains incomplete and is not reported as an operational success
