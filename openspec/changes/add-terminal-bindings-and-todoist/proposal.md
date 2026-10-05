## Why

Fleet's pane associations currently identify a layout address and workspace name. Moving a running terminal across workspaces changes that address and disconnects its favorites and tags. A Todoist sidebar needs durable links to the same terminal, so all three consumers need one Fleet-owned binding interface.

## What Changes

- Introduce a shared terminal-reference and association interface, scoped by member and multiplexer session, with live resolution independent of workspace, tab, position, name, or agent conversation.
- Carry an optional opaque terminal identity through the existing snapshot path. Reuse Collie's native pins and their browser-local storage through a narrow identity adapter; retain shared tag storage on the lead. Migrate only uniquely resolved legacy associations, retaining unresolved records without guessing.
- Add Todoist OAuth connection in Fleet settings and show tasks from all accessible projects. Identify each task's project and group tree views by project; validate account membership and same-project hierarchy on the server.
- Add a right-rail Todoist surface with list/tree views, full nested task browsing, a current-terminal bound-task area, task/subtask creation, editing, completion and reopening.
- Support many-to-many task/terminal associations and stable Fleet backlinks in task descriptions, preserving user-authored text.
- Reuse the native composer send flow for one-click task delivery and binding. Send an English template centered on the task description, with title, ancestor titles and Todoist URL. Do not automatically complete tasks.
- Refuse completion while any descendant is incomplete; refuse reopening while any ancestor is complete. Show blocking tasks without force or cascade actions.
- Reuse upstream routing, authentication, polling, controls and send verification. Keep integration, binding, migration and provider logic fork-owned.
- Non-goals: changing Collie's drafts, history or routing identity globally; synchronizing browser pins between devices; task deletion, comments or attachments; automatic agent-driven task completion; modifying Herdr itself or transporting live terminals between machines.

## Capabilities

### New Capabilities

- `fleet-terminal-bindings`: shared terminal identity, resolution, association operations and conservative legacy migration.
- `fleet-todoist`: account-wide OAuth client, nested tasks, guarded mutations, backlinks and composer delivery.

### Modified Capabilities

- `fleet-agent-favorites`: use terminal identity through the existing local pin store rather than layout identity when supported.
- `fleet-pane-tags`: use the shared terminal binding interface while preserving lead-owned definitions and associations.
- `fleet-native-navigation-sidebars`: add Todoist alongside Agents with responsive access.
- `fleet-settings`: expose installation-wide Todoist connection configuration and browser-local view preferences.

## Impact

Baseline: Collie v1.15.0, commit ef01b0ed4d9271897413984075aa6d2060ffcf2a. Product checkout started clean on main, level with origin/main; no matching active change existed. This change owns its artifact directory, new fleet/bindings and fleet/todoist modules, the explicitly enumerated snapshot/pin/composer ports, existing Fleet shell/settings/tag adapters, focused tests, translations, docs, CHANGELOG and FORK.toml. Exact edited paths will be recorded in design and the Git diff before publication. Unrelated concurrent edits remain outside ownership.

The optional identity field reaches peer-executed code, so a completed release requires a MINOR and peer upgrades. OAuth credentials and runtime associations stay in private runtime storage; no operator data belongs in the source tree. No parent deployment or configuration changes are included.
