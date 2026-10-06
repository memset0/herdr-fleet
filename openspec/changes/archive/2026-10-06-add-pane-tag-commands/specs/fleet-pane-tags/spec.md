## ADDED Requirements

### Requirement: Tag editors are reachable through commands and shortcuts
Fleet SHALL expose Edit Pane Tags for the exact current pane and Manage Tags for global definitions through the shared command bar and configurable shortcuts. Both SHALL ship unbound and remain searchable. The assignment command SHALL resolve host, session and terminal identity using the current scoped pane and SHALL refuse when that pane is absent rather than opening another pane's tags. Global management SHALL remain available without a pane or agent. Opening either command SHALL reuse the existing editor, preserve contained focus and return focus on dismissal, and SHALL NOT mutate tags until the operator explicitly edits them. All existing loading, failure, conflict, identity and mutation guards SHALL remain in force.

#### Scenario: A command opens current pane assignments
- **WHEN** the operator activates Edit Pane Tags from a command result or shortcut
- **THEN** the command bar closes and the existing assignment editor opens for the exact current pane without a write

#### Scenario: No pane is selected
- **WHEN** the operator has no current pane
- **THEN** Edit Pane Tags is unavailable and Manage Tags can still open global definitions

#### Scenario: The current route changes
- **WHEN** a shortcut runs after navigation to a pane on another host or session
- **THEN** its editor uses the new scoped terminal and does not retain the previous target
