## ADDED Requirements

### Requirement: Expanded Pane strips have continuous chrome ground
The native Pane's expanded Tab/Pane strip band SHALL paint its chrome background through its outer vertical padding and use balanced top/bottom insets. It SHALL NOT expose a page-ground bar below the tabs. Horizontal overflow, active-item reveal, tab and pane activation, folded summary behavior and existing touch target reach SHALL remain unchanged.

#### Scenario: Tabs stand above the mirror
- **WHEN** expanded strip rows are displayed on a Pane
- **THEN** their outer top/bottom padding has the same width and chrome ground, with no separate dark band below the Tab row
