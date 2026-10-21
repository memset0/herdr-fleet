## ADDED Requirements

### Requirement: A send is answered at once, never held
Fleet SHALL answer a send that the Send Protocol refuses before any key with that refusal at once, and SHALL NOT add it to the hold queue. A new send SHALL NOT wait behind requests already held; those SHALL still be released, cancelled or expired as before.

#### Scenario: A turn the harness cannot take a message in
- **WHEN** a send meets a running turn on a harness that cannot take a message during it
- **THEN** the send is refused `turn_running` at once, nothing is typed and nothing is held

#### Scenario: A pane with a request held from before
- **WHEN** a new send arrives for a pane that still holds an earlier request
- **THEN** the new send runs at once instead of joining behind it
