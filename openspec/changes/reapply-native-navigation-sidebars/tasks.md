## 1. Establish and publish the change boundary

- [x] 1.1 Re-read source instructions, all canonical specs, `FORK.toml`, current active changes, root/router/route data, `AgentList`, and deployment guidance; verify `v3-dev` matches `origin/v3-dev`, record task-owned paths, and leave `reapply-agent-favorites` and `reapply-manual-pane-fit` untouched.
- [ ] 1.2 Strictly validate the complete proposal/spec/design/tasks set, review it for public safety and exact Collie v1.2.0 scope, then commit only this change's planning paths as `docs(openspec): propose native navigation sidebars` and push with `SKIP_TESTS=1`.

## 2. Implement the owned navigation model and preferences

- [ ] 2.1 Add bounded local Space → Tab → Pane derivation under `fleet/ui/native-navigation/`; verify focused tests cover native ordering, Agent and shell Panes, missing relationships, selected ancestry, and no Host level or side effect.
- [ ] 2.2 Add the versioned preference codec/store with independent left/right preferred widths and collapsed states plus bounded Space/Tab disclosure; verify focused tests cover valid restore, width clamps, duplicate/unknown/malformed/oversized data, capacity limits, unavailable storage, and write failure with bounded in-memory continuity.
- [ ] 2.3 Add pure sidebar resize/collapse and mutually exclusive overlay transition helpers; verify focused tests cover keyboard increments/bounds, preferred-width restoration, one active overlay, close reasons, and focus-return intent.

## 3. Add the persistent native shell and hierarchy

- [ ] 3.1 Add the native hierarchy component using current snapshot data and `spacePath`/`panePath`/`useNavigate`; verify focused tests cover selected Pane highlighting, automatic Space/Tab disclosure, disclosure without navigation/request, shell Pane activation, and route activation exactly once.
- [ ] 3.2 Add the responsive root shell with independent desktop rails, pointer/keyboard separators, collapse/restore controls, responsive triggers, Escape/backdrop/close handling, inert and `aria-hidden` inactive descendants, focus restoration, and reduced-motion classes; verify focused component tests cover these accessibility and state transitions.
- [ ] 3.3 Wrap the existing root `<Outlet />` with the shell inside the persistent root route and verify a router test proves the same shell instance survives Home → Space → Pane while native child content and existing loaders remain in place.

## 4. Reuse the native Agent list

- [ ] 4.1 Add a narrow native Agent rail wrapper that renders the existing `AgentList` for desktop and responsive surfaces; verify focused tests preserve current favorite-aware section ordering, Agent-card controls, no shell rows, no duplicate favorite state, and one native Pane navigation.
- [ ] 4.2 Add only any presentation-level `AgentList` port proved necessary by the actual layout; verify its existing list/card/home tests remain unchanged in behavior and do not touch `ThreadSidebar`, manual fit, cards, composer, strips, or actions.
- [ ] 4.3 Add every navigation label to all six typed dictionaries; verify the i18n typecheck and focused rendered-label tests prevent dictionary drift.

## 5. Reconcile the fork and candidate

- [ ] 5.1 Extend the existing `fleet-runtime` contract/verification without a redundant owned block, and add one exact invasive native-navigation entry enumerating every root/component/test/i18n anchor; verify the fork checker accepts the candidate and no unrelated path is claimed.
- [ ] 5.2 Add one concise `CHANGELOG.md` line under `Unreleased` and reconcile proposal/spec/design/tasks with the implementation; verify no iframe, duplicate router, extra request, backend/API, mutation, Pack/Host, notification, ttyd, STT, release, deployment-mechanism, v2, favorite, manual-fit, composer, strip, action-sheet, or `ThreadSidebar` scope entered the candidate.
- [ ] 5.3 During implementation run only focused owned/component/root/router/storage/accessibility/i18n tests plus affected typecheck/lint/fork/OpenSpec checks; resolve failures without weakening bounds or native behavior.

## 6. Validate, commit, push, and stage

- [ ] 6.1 At commit readiness run the full root and Web suites exactly once with Bun 1.3.14, both typechecks, full-tree lint, production build, version/fork/strict OpenSpec checks, privacy/scope audit, and exact staged-diff review; record test counts and do not rerun passing full suites.
- [ ] 6.2 Commit the complete implementation as one conventional feature commit with the required co-author trailer, fetch and verify `origin/v3-dev`, push normally with `SKIP_TESTS=1` only after the final suite passes, and verify the remote exact commit is public-safe.
- [ ] 6.3 Deploy only the exact pushed candidate to isolated v3 staging with pinned Bun and the existing pattern; preserve browser settings, STT, Push state, v2, and Herdr, re-link/restart only `memset0.herdr-fleet`, verify readiness, and update deployment state only afterward.
- [ ] 6.4 Report planning and implementation commits, test counts, deployment identity, rollback, unchanged-service evidence, and the remaining owner browser checks without claiming acceptance.

## 7. Archive only after owner browser acceptance

- [ ] 7.1 After explicit owner acceptance, re-read all artifacts and implementation paths, incorporate any reality-driven corrections, and strictly validate the completed change.
- [ ] 7.2 Sync `fleet-native-navigation-sidebars` into canonical specs and archive through the generated workflow, then commit/push only the archive/spec paths and redeploy that exact archive HEAD without changing code or local settings.
