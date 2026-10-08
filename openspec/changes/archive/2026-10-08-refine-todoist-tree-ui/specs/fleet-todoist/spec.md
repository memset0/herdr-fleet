## ADDED Requirements

### Requirement: Tree hierarchy has visible guides
Tree rows SHALL distinguish parent-child hierarchy with visible connector guides and compact gutters rather than enlarged left padding. Guides SHALL be continuous across row spacing and expanded details, respect visible branch boundaries and remain decorative while keeping descendants visible and task titles readable in narrow sidebars.

#### Scenario: Three task levels are visible
- **WHEN** a parent, child and grandchild are shown in Tree
- **THEN** connectors identify both parent-child relationships and branch endings

### Requirement: Completion controls require expanded task details
Task headers SHALL NOT expose completion checkboxes or other direct completion controls. Operators SHALL first expand a task, then choose Complete or Reopen inside its details. This SHALL apply to active tasks and completed history and preserve all existing hierarchy guards and busy-state refusals.

#### Scenario: A collapsed task is selected
- **WHEN** the operator selects its task title
- **THEN** details reveal the status action without issuing a completion or reopening request

#### Scenario: A completed task is reopened
- **WHEN** the operator opens a completed task and chooses Reopen
- **THEN** the existing guarded reopening flow handles the request

### Requirement: Collapsed task headers are compact
Task headers SHALL omit binding controls and metadata until expanded. Desktop task rows SHALL use a compact single-line height while allowing long titles to wrap. Touch controls SHALL retain an adequate hit area.

#### Scenario: Task details are collapsed
- **WHEN** a task is displayed without expanded details
- **THEN** its compact header shows no Bind or Unbind action

### Requirement: Tree descendants remain visible without branch controls
Tree SHALL always show every included task descendant. Task headers SHALL omit both disclosure arrows and their empty leading control space. Guide gutters SHALL remain visible, and clicking a title SHALL still toggle only its inline details.

#### Scenario: Old branch preferences exist
- **WHEN** the browser contains a saved collapsed parent from an earlier version
- **THEN** Tree still shows its children and no branch collapse control is rendered

## MODIFIED Requirements

### Requirement: Project tasks have list and tree views
Fleet SHALL show all matching active tasks for the saved display selection (All by default, a project, or a saved Todoist filter) through complete pagination. Saved filter queries SHALL be resolved by ID and evaluated by Todoist, including for completed history. A missing or unsupported filter SHALL report an error rather than silently widening the view. Unmatched ancestors MAY supply title-only nesting context but SHALL NOT become matching task rows. Hierarchy guards SHALL inspect the full actual project regardless of display filtering. Tree view SHALL group tasks under named projects; project group headings SHALL identify their project, and per-task project metadata SHALL appear only in expanded details for task rows and bound-task entries. Accessible task names MAY identify the project for disambiguation. All-project and filter views SHALL hide projects with no visible tasks; an explicitly selected empty project SHALL retain its empty state. Tree view SHALL be the default with all included descendants visible; no branch collapse action or empty disclosure column SHALL be shown. Previously saved collapsed-branch preferences SHALL NOT hide descendants. For a saved filter, matching tasks SHALL seed the tree and all their active descendants SHALL be included recursively, even if excluded by the filter itself. List and Completed views SHALL continue to show only provider filter matches. List view SHALL include ancestor titles and sort all matching tasks across projects by most recent update first. Tree siblings SHALL sort by recent update while preserving hierarchy. Completed tasks SHALL have a separate history view with explicit coverage and pagination, sorted across projects by latest completion first (falling back to update time when unavailable). Completing a task SHALL invalidate cached history so it appears immediately upon opening Completed. Both views SHALL highlight current-terminal bindings and expose an additional bound-task area.

#### Scenario: The project spans several pages
- **WHEN** active task retrieval returns a continuation cursor
- **THEN** later pages are included and the interface does not claim a complete project until retrieval completes

#### Scenario: Display scope changes
- **WHEN** the operator chooses a project or saved filter in Settings or the sidebar
- **THEN** the sidebar shows only matching tasks, retains a separate bound-task area, and refuses stale-view writes

#### Scenario: A filter hides an incomplete descendant
- **WHEN** a matching parent is completed while a hidden descendant remains incomplete
- **THEN** the full-project hierarchy guard still blocks completion

#### Scenario: A saved filter matches only top-level tasks
- **WHEN** the filter excludes subtasks and a matching parent has active descendants
- **THEN** Tree includes those descendants under the parent while List retains only the matching entries

#### Scenario: All projects includes an empty project
- **WHEN** a project has no tasks in the current task view
- **THEN** All projects omits its group while selecting that project directly retains the empty state


#### Scenario: Task project metadata is expanded
- **WHEN** an operator opens a task
- **THEN** its details reveal project metadata omitted from its collapsed header

### Requirement: Task and terminal relations are many-to-many
Fleet SHALL use the common terminal binding contract for many-to-many task associations. Each association SHALL be reachable from Fleet and through a managed footer link in the Todoist task description. Every task row and available bound-task row SHALL expose bind/unbind actions only within expanded details, without requiring a message send. Binding SHALL work for any terminal with stable identity, including a shell without an agent; without a terminal selection the action SHALL be disabled and the interface SHALL explain how to enable it. Linking and unlinking SHALL preserve user-authored text and other links; duplicate requests SHALL not duplicate links. A missing terminal SHALL never redirect to a replacement terminal.

#### Scenario: A task is bound to two terminals
- **WHEN** both bindings succeed
- **THEN** both terminals highlight the task and the description exposes both stable links
