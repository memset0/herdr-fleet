## Purpose

Let operators manage tasks across all accessible Todoist projects beside their terminals and deliver tasks through the existing agent composer.

## ADDED Requirements

### Requirement: OAuth connection is private and account-scoped
Fleet SHALL connect through Todoist OAuth and keep credentials server-side. OAuth state SHALL be expiring, single-use and bound to the initiating Fleet session. The connection SHALL expose all accessible projects and their tasks with a shared Settings/sidebar display selector for All, one project or one saved filter; display selection SHALL NOT redefine OAuth authorization. Every mutation SHALL validate the active account generation, actual project membership and same-project parent relationships. Reconnection SHALL reject stale-view writes and retain account-qualified historical associations.

#### Scenario: A new task names a parent in another project
- **WHEN** a caller selects a destination project different from its parent task's project
- **THEN** Fleet refuses creation without modifying either project

#### Scenario: OAuth state is replayed
- **WHEN** a callback repeats a spent state or belongs to another Fleet session
- **THEN** the connection is not accepted

### Requirement: Project tasks have list and tree views
Fleet SHALL show all matching active tasks for the saved display selection (All by default, a project, or a saved Todoist filter) through complete pagination. Saved filter queries SHALL be resolved by ID and evaluated by Todoist, including for completed history. A missing or unsupported filter SHALL report an error rather than silently widening the view. Unmatched ancestors MAY supply title-only nesting context but SHALL NOT become matching task rows. Hierarchy guards SHALL inspect the full actual project regardless of display filtering. Tree view SHALL group tasks under named projects; task rows, details and bound-task entries SHALL identify their project. All-project and filter views SHALL hide projects with no visible tasks; an explicitly selected empty project SHALL retain its empty state. Tree view SHALL be the default with collapsible branches. For a saved filter, matching tasks SHALL seed the tree and all their active descendants SHALL be included recursively, even if excluded by the filter itself. List and Completed views SHALL continue to show only provider filter matches. List view SHALL include ancestor titles and sort all matching tasks across projects by most recent update first. Tree siblings SHALL sort by recent update while preserving hierarchy. Completed tasks SHALL have a separate history view with explicit coverage and pagination, sorted across projects by latest completion first (falling back to update time when unavailable). Completing a task SHALL invalidate cached history so it appears immediately upon opening Completed. Both views SHALL highlight current-terminal bindings and expose an additional bound-task area.

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

### Requirement: Operators can create and edit tasks
Fleet SHALL create tasks and subtasks and edit task titles and descriptions within their actual project; new root tasks SHALL require a destination project. It SHALL preserve hierarchy and managed backlinks and report provider failures or concurrent edit conflicts without claiming success.

#### Scenario: A subtask is created
- **WHEN** an operator chooses a parent task and submits a title and description
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
Fleet SHALL use the common terminal binding contract for many-to-many task associations. Each association SHALL be reachable from Fleet and through a managed footer link in the Todoist task description. Every task row and available bound-task row SHALL expose a visible bind/unbind action without expanding details or sending a message. Binding SHALL work for any terminal with stable identity, including a shell without an agent; without a terminal selection the action SHALL be disabled and the interface SHALL explain how to enable it. Linking and unlinking SHALL preserve user-authored text and other links; duplicate requests SHALL not duplicate links. A missing terminal SHALL never redirect to a replacement terminal.

#### Scenario: A task is bound to two terminals
- **WHEN** both bindings succeed
- **THEN** both terminals highlight the task and the description exposes both stable links

### Requirement: Delivery uses the native composer and description-led English context
A task send SHALL require an explicit confirmation dialog showing the task title and destination agent/terminal before any preparation, message submission or new binding. Cancel, Escape and dismissal SHALL produce no send or binding. A changed account, scope generation or terminal destination SHALL invalidate the pending confirmation. Binding-only retries after an acknowledged send SHALL not request another send confirmation or resend. A confirmed task send SHALL use the same guarded submission path as the native composer and automatically associate the task with its terminal. The English message SHALL include the title, description, ancestor titles without their descriptions, and task URL. It SHALL treat the description as the primary requirement and parent titles as context, request clarification for material ambiguity, require a result and verification report, and prohibit automatic Todoist completion. Managed backlink text SHALL be omitted. Existing drafts MUST NOT be silently overwritten.

#### Scenario: Backlink writing fails after a successful send
- **WHEN** delivery succeeded but linking remains incomplete
- **THEN** Fleet reports the partial outcome and retrying the link does not send the message again

#### Scenario: The composer refuses input
- **WHEN** the target is locked, missing, or has a blocking dialog
- **THEN** Todoist delivery follows the native refusal and does not claim a successful send

#### Scenario: The operator cancels a mistaken send
- **WHEN** Send to agent opens the confirmation and the operator cancels or dismisses it
- **THEN** no message preparation, terminal submission or binding request occurs

### Requirement: Task details expand in place
Selecting a task SHALL expand its description and actions immediately below that task inside one highlighted card, never at the bottom of the full list. The complete selected card SHALL have a visible background and border. Only one card SHALL be expanded at a time across task results and the bound-task area. Re-selecting it SHALL collapse it. Expansion and collapse SHALL animate downward in normal document flow using the existing Collapse primitive and respect reduced-motion preferences; hidden actions SHALL not remain focusable.

#### Scenario: The operator opens a task in the middle of the list
- **WHEN** the operator selects that task's title
- **THEN** its actions appear beneath its own header within the highlighted card and later rows move smoothly downward
