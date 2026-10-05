## Purpose

Let operators manage a selected Todoist project beside their terminals and deliver tasks through the existing agent composer.

## ADDED Requirements

### Requirement: OAuth connection is private and project-restricted
Fleet SHALL connect through Todoist OAuth and keep credentials server-side. OAuth state SHALL be expiring, single-use and bound to the initiating Fleet session. Outside project task data, only the account identity needed for the connection and project chooser metadata MAY be read; every task operation SHALL enforce the selected project on the server. Project switching SHALL reject stale-view writes and retain historical associations.

#### Scenario: A request names a task outside the selected project
- **WHEN** a caller submits another project's task ID
- **THEN** Fleet refuses the operation without modifying that task or returning its content

#### Scenario: OAuth state is replayed
- **WHEN** a callback repeats a spent state or belongs to another Fleet session
- **THEN** the connection is not accepted

### Requirement: Project tasks have list and tree views
Fleet SHALL show all active project tasks through complete pagination, preserving section and nesting relationships. Tree view SHALL be the default with collapsible branches. List view SHALL include ancestor titles. Completed tasks SHALL have a separate history view with explicit coverage and pagination. Both views SHALL highlight current-terminal bindings and expose an additional bound-task area.

#### Scenario: The project spans several pages
- **WHEN** active task retrieval returns a continuation cursor
- **THEN** later pages are included and the interface does not claim a complete project until retrieval completes

### Requirement: Operators can create and edit tasks
Fleet SHALL create tasks and subtasks and edit task titles and descriptions within the selected project. It SHALL preserve hierarchy and managed backlinks and report provider failures or concurrent edit conflicts without claiming success.

#### Scenario: A subtask is created
- **WHEN** an operator chooses a parent in the selected project and submits a title and description
- **THEN** the created task appears beneath that parent after successful provider confirmation

### Requirement: Completion and reopening cannot cascade implicitly
Before completing a task Fleet SHALL verify that every descendant is complete. Before reopening a task Fleet SHALL verify that every ancestor is incomplete. Violations SHALL block the mutation and display a dialog listing blocking tasks. There SHALL be no force or automatic cascade option. Failed or incomplete verification SHALL prevent mutation.

#### Scenario: A grandchild is incomplete
- **WHEN** the operator completes its ancestor
- **THEN** Fleet refuses completion and identifies the incomplete descendant

#### Scenario: A grandparent is complete
- **WHEN** the operator reopens its descendant
- **THEN** Fleet refuses reopening and lists completed ancestors from outermost to innermost

### Requirement: Task and terminal relations are many-to-many
Fleet SHALL use the common terminal binding contract for many-to-many task associations. Each association SHALL be reachable from Fleet and through a managed footer link in the Todoist task description. Linking and unlinking SHALL preserve user-authored text and other links; duplicate requests SHALL not duplicate links. A missing terminal SHALL never redirect to a replacement terminal.

#### Scenario: A task is bound to two terminals
- **WHEN** both bindings succeed
- **THEN** both terminals highlight the task and the description exposes both stable links

### Requirement: Delivery uses the native composer and description-led English context
A one-click task send SHALL use the same guarded submission path as the native composer and automatically associate the task with its terminal. The English message SHALL include the title, description, ancestor titles without their descriptions, and task URL. It SHALL treat the description as the primary requirement and parent titles as context, request clarification for material ambiguity, require a result and verification report, and prohibit automatic Todoist completion. Managed backlink text SHALL be omitted. Existing drafts MUST NOT be silently overwritten.

#### Scenario: Backlink writing fails after a successful send
- **WHEN** delivery succeeded but linking remains incomplete
- **THEN** Fleet reports the partial outcome and retrying the link does not send the message again

#### Scenario: The composer refuses input
- **WHEN** the target is locked, missing, or has a blocking dialog
- **THEN** Todoist delivery follows the native refusal and does not claim a successful send
