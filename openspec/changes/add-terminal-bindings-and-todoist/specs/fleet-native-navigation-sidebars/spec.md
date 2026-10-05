## ADDED Requirements

### Requirement: Todoist shares the right navigation surface
The right rail SHALL offer Agents and Todoist views without removing the existing Agent controls. Narrow layouts SHALL expose the same Todoist functionality through an accessible surface. The rail SHALL show the display scope selected in Settings or directly in the rail, identify each task's project and allow task view switching; All SHALL be the default available selection. Opening or closing the surface SHALL preserve native route and keyboard-focus behavior.

#### Scenario: The operator switches the right rail
- **WHEN** Todoist is selected beside a pane
- **THEN** that pane remains open and its bound tasks appear alongside the selected task view

#### Scenario: A narrow viewport is used
- **WHEN** the persistent right rail is unavailable
- **THEN** the operator can still open, operate and dismiss Todoist without losing the native composer
