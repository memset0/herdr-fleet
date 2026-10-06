## ADDED Requirements

### Requirement: Tree nesting is visibly indented
Tree rows SHALL visibly distinguish each child level through increased indentation while retaining branch controls and readable task titles in narrow sidebars.

#### Scenario: Three task levels are visible
- **WHEN** a parent, child and grandchild are shown in Tree
- **THEN** each descendant is indented further than its parent

### Requirement: Completion controls require expanded task details
Task headers SHALL NOT expose completion checkboxes or other direct completion controls. Operators SHALL first expand a task, then choose Complete or Reopen inside its details. This SHALL apply to active tasks and completed history and preserve all existing hierarchy guards and busy-state refusals.

#### Scenario: A collapsed task is selected
- **WHEN** the operator selects its task title
- **THEN** details reveal the status action without issuing a completion or reopening request

#### Scenario: A completed task is reopened
- **WHEN** the operator opens a completed task and chooses Reopen
- **THEN** the existing guarded reopening flow handles the request
