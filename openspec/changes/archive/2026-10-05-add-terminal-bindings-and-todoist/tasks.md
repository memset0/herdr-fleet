## 1. Shared terminal bindings

- [x] 1.1 Add typed terminal references, live resolution and idempotent relation operations; verify moves, swaps, rename, host/session separation, absence, replacement and ambiguity with focused tests.
- [x] 1.2 Propagate optional opaque identity through adapter, snapshot and peer serialization using narrow ports; verify end-to-end projection and older-peer compatibility, and document the wire addition.
- [x] 1.3 Adapt all native pin entrypoints and shared tags to the common identity layer, preserving storage scopes and conservative migration; verify migration, reload, relocation and unpin/detach behavior.

## 2. Todoist service

- [x] 2.1 Implement OAuth configuration, session-bound state and private credential persistence; verify callback, replay, expiry, wrong-session and disconnect cases with synthetic provider responses.
- [x] 2.2 Implement All/project/saved-filter display selection, complete pagination and project-local hierarchy lookup; verify membership, provider filter/history parameters, complete filtered subtrees, hidden-descendant guards and stale-selection races.
- [x] 2.3 Implement create/edit/complete/reopen with hierarchy guards and typed blockers; verify deep ancestors/descendants, incomplete reads, concurrent changes and recurring-task refresh behavior.
- [x] 2.4 Implement many-to-many relations and description-footer backlinks through the shared layer; verify idempotency, preservation of user text, failure recovery and stable redirect after relocation.

## 3. Native UI and delivery

- [x] 3.1 Add always-visible direct bind/unbind actions and right-rail and narrow-screen Todoist access, recent-first list/history and project-grouped tree views, display-scope labels, bound-task area and destination-aware task forms and animated inline task-detail cards; verify empty-project visibility, multiple projects, nesting, pagination and keyboard behavior.
- [x] 3.2 Add connection settings with All/project/filter selection and translated status/blocker dialogs; verify secrets never reach browser state and account changes invalidate old actions; diagnose and verify the reported Connect interaction.
- [x] 3.3 Require task/destination confirmation before sending, invalidate it on target changes, and add description-led English task formatting and a narrow native composer action port; verify ancestor titles, footer removal, draft protection, target changes and existing send refusal behavior.
- [x] 3.4 Separate send and relation outcomes so retries never resend acknowledged messages; verify partial failures and retry recovery across the composed flow.

## 4. Acceptance and publication

- [x] 4.1 Reconcile implementation, documentation, CHANGELOG, AGENTS fork departures and FORK.toml; run fork-boundary and public-tree privacy audits successfully.
- [x] 4.2 Run root/web typechecks, full lint, backend/frontend suites and isolated browser checks; demonstrate a terminal move preserves favorites, tags and task bindings without manipulating user terminals.
**Deferred verification 4.3 — not completed:** The full operator-account checklist for reversible edits, guarded completion/reopening and actual backlink navigation remains a follow-up. Account connection, reads/filter/history and UI delivery guards have evidence; synthetic provider/composer tests cover writes and delivery. No unexecuted live step is represented as passed. The owner requested archival of the accepted functional scope and a separate UI handoff.
- [x] 4.4 Record reviewed releases/deployment and UI handoff, synchronize all six capability deltas, and archive the accepted functional scope under the owner's explicit closure instruction. Preserve deferred verification 4.3 rather than mark it complete; verify archival and existing release-publication evidence.
