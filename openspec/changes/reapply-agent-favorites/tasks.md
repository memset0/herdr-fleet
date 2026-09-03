## 1. Establish the owned favorite-state boundary

- [ ] 1.1 Re-read the exact Collie v1.2.0 Agent list/card/triage implementation, current source specs, `FORK.toml`, and this change; record the clean `v3-dev` baseline and exact task-owned paths, and verify no parent or private deployment path is claimed.
- [ ] 1.2 Add the fork-owned favorite identity and versioned bounded storage codec under `fleet/ui/`; verify focused tests cover optional Host/session separation, Pane/implementation changes, malformed/unsupported/oversized records, capacity eviction, unavailable storage, and write failure with bounded in-memory continuity.
- [ ] 1.3 Add the pure stable favorite-first partition helper and verify it preserves the input comparator order for favorites and non-favorites, including ties and newest/oldest `Recent` order.

## 2. Integrate favorites into native Collie Agent rows

- [ ] 2.1 Add the narrow `AgentList` subscription/toggle adapter and apply favorite partitioning only after native `triage()`; verify focused list tests preserve section classification/order/counts and move favorites only within their current section.
- [ ] 2.2 Add the sibling favorite control port to `AgentCard` for Agent rows only, reserving a non-overlapping trailing slot in card and flat-row densities; verify valid interactive markup, `aria-pressed`, localized labels, focus retention, no Pane navigation/request, ordinary row opening, and unchanged shell rows.
- [ ] 2.3 Add the favorite/unfavorite accessible strings to every typed Collie dictionary and verify typecheck plus focused locale rendering tests prevent dictionary drift.

## 3. Reconcile the fork boundary and public artifacts

- [ ] 3.1 Update `FORK.toml` with one owned `fleet/ui/**` boundary and exact invasive Agent list/card/test/i18n ports; verify the fork checker rejects any unclassified or broader upstream edit.
- [ ] 3.2 Add one concise `CHANGELOG.md` entry under `Unreleased` and reconcile proposal/spec/design/tasks with the implementation, preserving the no-API/no-router/no-Pack/no-iframe scope.
- [ ] 3.3 Run the tracked-tree privacy and scope audit; verify no private deployment value, backend favorite state, route, loader, Gateway, bridge, service-worker, Pack, SSH, notification, ttyd, or STT change entered the candidate.

## 4. Validate, publish, and stage the candidate

- [ ] 4.1 During implementation run only the focused owned/list/card/i18n tests plus affected typecheck/lint/fork/OpenSpec checks; resolve failures without weakening native Collie behavior or the storage bounds.
- [ ] 4.2 At commit readiness run the full root and Web suites once with Bun 1.3.14, both typechecks, full-tree lint, version/fork checks, production build, strict OpenSpec validation, and exact staged diff review.
- [ ] 4.3 Commit the complete feature as one reviewed conventional commit on `v3-dev`, fetch/verify `origin/v3-dev`, push normally, and verify the remote exact commit remains public-safe and independently buildable.
- [ ] 4.4 Deploy only that exact pushed commit through the existing isolated v3 staging workflow, preserve browser-local settings/STT state and all v2/Herdr processes, and verify the native UI can favorite/unfavorite without navigation while group ordering changes as specified.
- [ ] 4.5 Present the candidate commit, source link, focused/full verification, staging behavior, storage boundary, rollback, and unchanged-service evidence for owner acceptance.

## 5. Reconcile and archive after acceptance

- [ ] 5.1 After owner acceptance, re-read every artifact and implementation path, make any reality-driven artifact correction, and strictly validate the completed change.
- [ ] 5.2 Sync `fleet-agent-favorites` into the canonical source specs, verify no upstream Collie capability was duplicated, and archive `reapply-agent-favorites` through the generated workflow.
- [ ] 5.3 Commit only the canonical spec and archive paths in a separate OpenSpec commit, fetch/verify `origin/v3-dev`, push normally, redeploy the new exact archive HEAD without changing code or local settings, and report all commit/deployment identities.
