## Context

See proposal.md. The inherited pin store keys rows by host, session, pane ID and workspace name. Tags intentionally copied that identity. Herdr 0.9.3 keeps terminal identity while cross-workspace moves replace the public pane ID. Its ordinary adapter currently drops terminal identity before constructing the view. Collie v1.15.0 is the reviewed baseline.

## Goals / Non-Goals

Provide one small, typed Fleet binding layer used by favorites, tags and Todoist. Share identity, reference validation, matching, resolution and idempotent relation operations; keep each consumer's payload and storage ownership separate. Do not build a plugin registry or replace every upstream pane address: drafts, transcript caches and live transport remain upstream-owned.

## Decisions

### Identity and resolution

Carry optional opaque `bindingId` and canonical `bindingSession` fields in the existing pane model, populated by a fork-owned Herdr adapter helper. The wire carries a namespaced SHA-256 fingerprint of the terminal ID, never the raw terminal-command identifier. Qualify it by host and multiplexer session in a versioned `TerminalRef`. Workspace, tab, label and current pane ID are mutable location metadata, never durable identity. Expose `reference`, `key`, `resolve`, `attach`, `detach` and `list` semantics from fleet/bindings. Resolution must return exactly one live match or a typed unavailable/ambiguous result. An offline member is unavailable, not evidence of terminal death. Closed terminals retain dormant references; a replacement terminal never inherits them. Same-machine moves are supported; moving a process between machines is not a Herdr layout operation and is not inferred.

The browser treats the identity as data, never a credential. Server-side writes and deep links resolve it against authoritative current inventory. An opaque stable Fleet backlink resolves the terminal reference to today's native pane URL, including host/session scope. Peer identities travel through existing authenticated snapshots; no remote multiplexer socket access and no browser-supplied terminal attach command are introduced.

### Consumer adapters and migration

Favorites stay in Collie's one browser-local pin store; a narrow identity hook delegates Fleet-specific keys to the common layer. All pin entrypoints consequently agree. Tags retain their shared lead store and optimistic version checks, adapting associations to the same terminal reference. Todoist stores typed many-to-many relations to account/project/task IDs, so equal task IDs from different connections cannot collide. Each adapter preserves the original storage scope rather than putting personal browser pins on the server.

Migrate a legacy association only with one fresh, exact host/session/pane/workspace match and a valid terminal identity; never match by name, cwd, agent or row order. Keep unresolved legacy entries intact and dormant. Record conversion durably before dropping the old form, deduplicate relations, and retain unsupported/older-peer behavior without pretending a layout address is a stable terminal reference. No mandatory manual data migration or credential changes are required for existing features. New Todoist binds require actual terminal identity.

### Todoist authorization and storage

Use the official API v1 and OAuth authorization-code flow, with `data:read_write`. OAuth app client credentials are operator-provided runtime configuration; access tokens stay in owner-only server storage and never in browser storage, URLs or logs. OAuth state is random, short-lived, single-use and bound to the initiating authenticated Fleet session. The existing Strict session cookie is not relaxed: the provider callback lands on a same-origin continuation page and completes through an authenticated same-origin fetch. Redirect targets and provider hosts are fixed, not caller-supplied.

One connection per Fleet installation. The operator explicitly authorizes listing all accessible projects and their tasks, replacing the earlier single-project restriction. Fetch complete active task/project/section inventories across the account. Show project names on task rows and details and group tree rows by project, preserving project-local nesting. New root tasks require an explicit destination project; subtasks inherit their parent's project. Validate accessible project membership and reject mismatched parent/project input. Connection changes invalidate stale actions and historical relations remain account-qualified. Keep reading the legacy optional project field for private state compatibility, but it no longer limits access or appears as a selector in Settings. Disconnect removes active credentials and stops requests without deleting bindings.

### Task hierarchy and guarded actions

Load all pages of active tasks and sections. Tree view preserves parent relationships and sibling order; list view includes ancestor titles. Completed history is a separate paginated view with explicit date coverage and load-more, not a claim that one page contains all history. Expand historical coverage as needed to verify ancestors and descendants. A cycle, missing required ancestor, incomplete pagination or failed read makes a guarded mutation unavailable.

Before closing a task, fetch fresh project hierarchy and refuse if any descendant is incomplete. Before reopening, fetch the complete ancestor chain and refuse if any ancestor is complete. Return a typed blocker list rendered in a modal; no force, cascade or hidden side effects. Follow provider semantics for recurring tasks and refresh after every write. Todoist offers no transaction spanning hierarchy validation and mutation: refresh immediately before mutation, serialize Fleet writes, then re-read; external clients can still race and that limitation must be documented rather than claiming cross-provider atomicity.

### Backlinks and delivery

Maintain a delimited Fleet-owned footer in task descriptions. Preserve the user's text, remove only our own matching link when unbinding, never append duplicates, and re-read before writing. Reject conflicting user edits rather than overwriting them. Bound tasks remain in the project tree and also appear in the current-terminal area.

Expose a narrow composer action port so Todoist invokes the same guarded send function as ordinary text submission, without replacing an existing draft or arming force/raw typing. Target resolution must be refreshed before delivery; navigation or target identity change invalidates the pending action. Track send and backlink outcomes separately: retrying binding/backlink work cannot resend a message already submitted. Failed, blocked or uncertain sends never claim success.

Use an English template containing the task title, ancestor titles from root to direct parent, description without the managed footer, and Todoist URL. The description is the primary instruction; parent titles provide context, not additional work. Ask for material missing requirements, proceed on minor details, report verification, and do not automatically complete the task. Do not include parent descriptions or child task bodies by default.

### UI and fork boundary

Add Agents/Todoist tabs to the right rail and equivalent narrow-screen access. Default to tree view; remember view and expansion locally. Reuse native controls and translated dialogs, preserve existing agents and navigation behavior. Settings contain OAuth connect/disconnect and an explicit all-projects scope description. Task edit supports title/description; task creation supports a selected parent. Surface loading, empty, unavailable, stale, busy and conflict states.

Owned modules: fleet/bindings/**, fleet/todoist/**, Fleet web adapters/components and their tests. Planned narrow upstream ports: bridge/mux/types.ts, bridge/mux/herdr/adapter.ts, bridge/types.ts, bridge/state-engine.ts, web/src/lib/types.ts (optional opaque identity propagation); web/src/lib/pins.ts (common identity adapter); web/src/components/composer.tsx and its owning route/context (shared send action only); the existing translation dictionaries. Any required crew decoder port must be additive-optional, documented in CREW_PROTOCOL.md and registered in FORK.toml. Business logic remains in owned modules; final exact ports and verification anchors must be reconciled with implementation before archive. ADR 0070's place-key policy is intentionally superseded only for Fleet terminals with stable identity; its local storage and interaction semantics remain.

## Risks / Trade-offs

- Old peer lacks identity → preserve existing UI, refuse new durable links, and require the new minor before fleet-wide acceptance.
- Legacy records lack historical terminal proof → use exact fresh evidence only, retain unresolved records, never guess relocation.
- Provider/client concurrency → fresh reads, serialized Fleet actions, explicit conflict/error states; no distributed-transaction claim.
- Sending and linking are separate remote actions → persist/report their stages and retry only unfinished work.
- OAuth requires an application registration and a user login → build and test the entire flow with synthetic responses; live acceptance remains pending until the operator supplies runtime credentials and logs in.

## Migration Plan

Implement and validate the binding substrate first, then consumer adapters and Todoist. Preserve legacy storage until successful conversion; use atomic private writes and schema validation. Run identity/reorder/move/absence/ID-replacement and consumer tests, both typechecks, lint, full backend/frontend suites, fork/privacy checks and isolated browser checks. Never move or close a user's live terminal to test. Release assessment is MINOR because peer-executed snapshot code changes; choose the next exact version from remote tags at release time. Automated code acceptance precedes any functional checkpoint publication. A reviewed build must then be deployed to the registered callback origin before live OAuth acceptance can run. Keep the change active until that operator-assisted acceptance passes; do not archive it merely because code was published. Rollback uses the prior product build and preserved legacy data; never discard newly created relations silently.

## Implementation refinements

- Canonical session identity is carried separately because Collie intentionally removes its display-session tag in narrow views. The gateway inventories each member using its existing `host` query parameter and all-session snapshot, excluding unreachable evidence.
- Pins and tags adapt their existing row/space format through the same versioned key codec. This preserves their file/browser storage contracts while removing layout from stable identity. Their migrations share the exact-evidence helper; tag migration is serialized with normal writes.
- The Todoist provider uses current API v1 `checked`/`content`/`description` task fields, active `results` pagination and completed `items` pagination. OAuth handles expiring access tokens and persisted rotated refresh tokens.
- The OAuth configuration form accepts application credentials over the authenticated same-origin API and never reads secrets back. Provider callback GET embeds no request values. A fixed same-origin script removes the query from browser history and submits only on Continue. The browser probe confirmed a plain form sends Origin: null under no-referrer, so the script uses the same fetch path as other authenticated mutations without loosening the origin gate.
- The composer port inserts a task through its existing draft writer and shares the Send button's submission function. It refuses an occupied draft, attachments, a bare shell, raw typing, a locked/hidden page and an already armed override. Native refusal retains the task draft. Browser receipts distinguish acknowledged sends awaiting backlinks, including reload recovery where storage is available.
- Both desktop right rail and native pane switcher expose Agents/Todoist selection. Todoist then switches its own tree/list/history views. The task description is content text, not rendered HTML. All seven current dictionaries carry the new labels.

## Review baseline and ownership

The automated review snapshot is based on main commit 3a6e7329011a2638a857959827a2f345617e5791
(product 3.7.8), incorporating the independently completed Agent-card presentation work. This task
owns only the binding/Todoist implementation and its narrow ports, tests, translations and artifacts.
Shared governance, changelog and documentation files were re-read before publication.
Before publication, the snapshot was reconciled with main b22be82f1c5c034e19362d2130a62c1a1ca06b39
(product 3.7.9); both typechecks, full lint and affected navigation/composer/Todoist suites
were repeated for the combined tree.

## Additional implementation details

- Completed recurring history is an occurrence record, not an instruction to complete the next occurrence again. The history UI disables toggling an already-active recurring task and explains that its next occurrence is open; backend reopening refuses that historical operation. Ordinary active recurring tasks retain Todoist close semantics.

- Before the first durable conversion, pins retain a browser-local recovery snapshot and tags retain a private file snapshot. These are not alternate live stores. If the browser cannot retain recovery data, migration changes memory only. Old builds cannot interpret stable associations; rollback retains both current data and recovery copies instead of silently replacing newer relations.

## Automated validation

- Full root gate: 6,422 Bun tests passed across bridge, CLI, scripts and Fleet, plus the shell lifecycle/package checks.
- Full frontend gate: 324 files, 13,943 passed, 32 expected failures and 47 existing todo cases; command exit status zero.
- Both typechecks, full-tree lint, fork-boundary audit, product build and source privacy audit passed.
- Real Chromium checks cover desktop/mobile Agents–Todoist switching, pins/tags/task relations after a workspace move, nested-row geometry and 44px completion targets, and the cross-site OAuth return followed by a Strict-cookie same-origin continuation.
- Focused checks cover exact migration/recovery, provider pagination, hierarchy blockers, description editing, many-to-many backlink retries and native guarded composer delivery without overwriting drafts or sending to shells.
- Operator-assisted provider acceptance remains outstanding. Source publication and the lead deployment make the registered callback available; archive waits for the actual authorized-project checks.

## Revised all-project acceptance

The operator changed the desired scope after the first deployed checkpoint. Verify multiple projects with equal task titles, project grouping/labels, destination selection, cross-project parent rejection, all-project history and bindings, and stale-account refusal. Repeat the affected backend/frontend/browser gates before a lead-only patch release. Real write probes stay within the operator-designated test project. Diagnose the reported Connect interaction against the real deployed browser before claiming it fixed.

The all-project follow-up passed the full root and frontend suites, both typechecks, lint, build, and four Chromium cases. OAuth Connect was also exercised against the deployed settings page: it returns a provider authorization URL and navigates correctly. An invalid redirect response is fixed in the OAuth application registration by matching the displayed callback URL exactly. Settings now exposes the non-secret Client ID and a saved-secret indicator; it remains usable even if task retrieval fails. This follow-up is lead-only and therefore PATCH on the already released 3.8 line. Provider consent and real task acceptance remain pending.
