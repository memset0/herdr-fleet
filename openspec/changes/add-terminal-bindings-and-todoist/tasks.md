## 1. Shared terminal bindings

- [x] 1.1 Add typed terminal references, live resolution and idempotent relation operations; verify moves, swaps, rename, host/session separation, absence, replacement and ambiguity with focused tests.
- [x] 1.2 Propagate optional opaque identity through adapter, snapshot and peer serialization using narrow ports; verify end-to-end projection and older-peer compatibility, and document the wire addition.
- [x] 1.3 Adapt all native pin entrypoints and shared tags to the common identity layer, preserving storage scopes and conservative migration; verify migration, reload, relocation and unpin/detach behavior.

## 2. Todoist service

- [x] 2.1 Implement OAuth configuration, session-bound state and private credential persistence; verify callback, replay, expiry, wrong-session and disconnect cases with synthetic provider responses.
- [x] 2.2 Implement all-project inventory, complete pagination and project-local hierarchy lookup; verify accessible membership, mismatched parent rejection and stale-account races.
- [x] 2.3 Implement create/edit/complete/reopen with hierarchy guards and typed blockers; verify deep ancestors/descendants, incomplete reads, concurrent changes and recurring-task refresh behavior.
- [x] 2.4 Implement many-to-many relations and description-footer backlinks through the shared layer; verify idempotency, preservation of user text, failure recovery and stable redirect after relocation.

## 3. Native UI and delivery

- [x] 3.1 Add right-rail and narrow-screen Todoist access, project-grouped tree/list/history views, project labels, bound-task area and destination-aware task forms; verify multiple projects, nesting, pagination and keyboard behavior.
- [x] 3.2 Add connection settings with all-projects scope and translated status/blocker dialogs; verify secrets never reach browser state and account changes invalidate old actions; diagnose and verify the reported Connect interaction.
- [x] 3.3 Add description-led English task formatting and a narrow native composer action port; verify ancestor titles, footer removal, draft protection, target changes and existing send refusal behavior.
- [x] 3.4 Separate send and relation outcomes so retries never resend acknowledged messages; verify partial failures and retry recovery across the composed flow.

## 4. Acceptance and publication

- [x] 4.1 Reconcile implementation, documentation, CHANGELOG, AGENTS fork departures and FORK.toml; run fork-boundary and public-tree privacy audits successfully.
- [x] 4.2 Run root/web typechecks, full lint, backend/frontend suites and isolated browser checks; demonstrate a terminal move preserves favorites, tags and task bindings without manipulating user terminals.
- [ ] 4.3 With operator-provided OAuth app configuration and login, verify all-project reads, reversible task edits, guarded completion, backlink navigation and native agent delivery; retain the change active until live acceptance is available.
- [ ] 4.4 Prepare reviewed publication and deployment after automated acceptance, assess the exact next release against remote tags, and report peer deployment requirements. Sync/archive only after live acceptance; verify the final OpenSpec state and publication evidence.
