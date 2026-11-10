## ADDED Requirements

### Requirement: Core startup has a patient bounded readiness window
Core-backed Fleet SHALL allow healthy cold initialization to exceed the legacy child readiness window, with a finite deadline. It SHALL become ready immediately on positive evidence. Its control caller SHALL wait longer than child initialization, and a concurrent launcher MUST NOT reclaim the launch lock during that valid startup interval. The TUI profile SHALL retain its existing startup policy.

#### Scenario: Core initializes after the legacy window
- **WHEN** a Core child starts listening after the legacy readiness deadline but within the Core deadline
- **THEN** its generation becomes ready without restarting Core, losing terminals or requiring another operator start

#### Scenario: A second launcher observes startup
- **WHEN** another start occurs during the permitted Core initialization interval
- **THEN** it waits for the same generation and does not reclaim a valid launch lock or create another supervisor

#### Scenario: Initialization never becomes ready
- **WHEN** the finite startup deadline expires
- **THEN** startup reports failure and the existing generation-owned cleanup and rollback boundaries remain in force

#### Scenario: A child is immediately ready
- **WHEN** readiness evidence arrives before the longer Core deadline
- **THEN** startup finishes promptly without waiting out the remaining window
