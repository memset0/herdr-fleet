## Purpose

Keep speech operations bounded by their existing whole-operation deadline even when successive phases briefly have no active wait listener on the supported runtime.

## ADDED Requirements

### Requirement: A speech deadline survives the gap between phases
Fleet SHALL preserve the speech operation's original timeout across token lookup, request, retry and response disposal, including an operation without a caller-provided cancellation signal. Completing one phase SHALL NOT disarm the deadline for subsequent phases. Existing timeout budgets and caller-cancellation precedence SHALL remain unchanged.

#### Scenario: Disposal stalls after a completed request
- **WHEN** a speech identity probe has obtained its token and response but disposing of a refused response never settles
- **THEN** the original deadline terminates the probe as a timeout and no fallback request begins

#### Scenario: Wait listeners are replaced between phases
- **WHEN** one phase finishes and removes its listener before the next phase begins waiting
- **THEN** the deadline remains armed and the later phase receives the timeout

#### Scenario: Caller cancellation wins first
- **WHEN** the caller cancels before the deadline
- **THEN** the operation remains classified as caller cancellation rather than a timeout
