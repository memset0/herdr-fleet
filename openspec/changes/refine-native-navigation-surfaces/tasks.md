## 1. Establish and publish the change boundary

- [ ] 1.1 Re-read the source instructions, `FORK.toml`, the canonical `fleet-native-navigation-sidebars` spec, the current shell/tree/rail/preference implementation, the header host, the root route, and the Pane page's switcher; record the task-owned paths and leave the concurrent `adopt-native-pack-authority` change and every `fleet/**` runtime path it owns untouched.
- [ ] 1.2 Strictly validate the complete proposal/spec/design/tasks set, review it for public safety and exact Collie v1.2.0 scope, then commit only this change's planning paths as `docs(openspec): propose refined navigation surfaces`.

## 2. Rework the owned navigation model

- [ ] 2.1 Extend `fleet/ui/native-navigation/model.ts` with a Host root derived from the existing snapshot roster, one row shape carrying depth, label, icon kind, disclosure identity, activation target and children, single-child elision with deeper-name-and-icon precedence, and a group icon only where more than one child survives elision; keep every existing bound and add none of its own requests.
- [ ] 2.2 Update `fleet/ui/native-navigation/model.test.ts` to cover the solo one-Host case, a named roster, elision of a single-Tab Space and a single-Pane Tab, a Tab that keeps its group row and icon, ancestry identities for the selected Pane, shell Panes, and unchanged ordering and bounds.
- [ ] 2.3 Remove collapsed state and the overlay-pair helpers from `fleet/ui/native-navigation/preferences.ts` while keeping the storage key, version, widths, bounds, disclosure and failure behavior, and keep tolerating a legacy `collapsed` key on read.
- [ ] 2.4 Update `fleet/ui/native-navigation/preferences.test.ts` for the legacy-record case, the absence of collapsed state, and the unchanged width, disclosure, malformed, oversized, unavailable-storage and write-failure behavior.

## 3. Rebuild the shell, its rails and its narrow-layout entry

- [ ] 3.1 Rewrite `web/src/components/native-navigation-shell.tsx` so both rails are permanently expanded with no collapse control, the route column holds the header and outlet, one hierarchy overlay remains for the narrow layout, the background is inert while it is open, and focus returns to the header trigger from an effect after inertness is lifted.
- [ ] 3.2 Export a fork-owned navigation context plus the header's hierarchy trigger component and the pane-switcher presentation the Pane page reads, all fed from the shell's existing snapshot-derived rows and open handlers.
- [ ] 3.3 Add the optional `leading` slot to `AppHeaderHost` in `web/src/components/app-header.tsx`, rendered at the start of the non-override header row, and re-nest `web/src/routes/root.tsx` so the shell wraps the header host and passes the trigger.
- [ ] 3.4 Update `web/src/components/native-navigation-shell.test.tsx` and add focused header/root coverage for the leading slot, the absent collapse control, the confined header column, keyboard and pointer resizing, overlay inertness and focus return, and reduced motion.
- [ ] 3.5 Remove the centred reading column and the narrow header claim from `web/src/routes/home.tsx`, `web/src/routes/space.tsx`, `web/src/routes/settings.tsx` and `web/src/routes/pack.tsx`, and cover the full-width result without changing the header's claim contract or the Pane and history routes.

## 4. Rework the hierarchy presentation

- [ ] 4.1 Rewrite `web/src/components/native-navigation-tree.tsx` around one row component that carries the whole-row highlight including its disclosure control, one shared disclosure control with a single size and indentation step, group icons only on surviving group rows, no Space icon, and a compact wide-layout row height with a touch-sized height below the breakpoint.
- [ ] 4.2 Wrap every disclosure subtree in Collie's existing `Collapse` so it animates in flow, leaves the tab order with its pixels, and snaps under a reduced-motion preference.
- [ ] 4.3 Update `web/src/components/native-navigation-tree.test.tsx` for elided levels, group rows, Host rows, whole-row selection, one shared disclosure control, animated disclosure without navigation or request, and shell Pane activation.

## 5. Present the Agent rail from the Pane page's existing entry

- [ ] 5.1 In `web/src/components/agent-chat.tsx`, hide the pane-switcher entry at the wide breakpoint by class, and render the fork-provided switcher presentation and title in the existing sheet when one is provided, keeping the upstream pane list as the standalone fallback.
- [ ] 5.2 Add focused Pane-page coverage for the hidden wide-layout entry, the Agent content in the sheet, one native Pane navigation on row activation, and the unchanged gesture, composer, strips and thread sidebar.

## 6. Reconcile labels, fork boundary and changelog

- [ ] 6.1 Update all six typed dictionaries: rename the hierarchy panel for the herd, add the Host and header-trigger labels, drop the collapse/expand rail labels, and keep the i18n typecheck and dictionary-parity test green.
- [ ] 6.2 Update `FORK.toml` so the existing native-navigation invasive entry enumerates the header leading slot, the root nesting, and the Pane page's switcher anchors with their reasons and focused verification, and so the owned `fleet-runtime` contract states the permanently expanded rails; verify the fork checker accepts the candidate and claims no unrelated path.
- [ ] 6.3 Add one concise `CHANGELOG.md` line under `Unreleased` without touching the version files, and reconcile proposal, spec, design and tasks with what was actually implemented.

## 7. Verify, commit and push

- [ ] 7.1 Run the focused owned, component, header, root and i18n tests plus the Web typecheck and lint with the pinned Bun release; attribute any `fleet/**` runtime failure to the concurrent Pack change rather than resolving it here, and re-run only what this change touches.
- [ ] 7.2 At commit readiness run the Web suite and production build once, plus the version, fork and strict OpenSpec checks, and review the exact staged diff for public safety and for paths owned by the concurrent change.
- [ ] 7.3 Commit only this change's implementation paths as one conventional feature commit, fetch and verify `origin/v3-dev`, and push normally.

## 8. Hand back for acceptance

- [ ] 8.1 Report the planning and implementation commits, what was verified and what was not, the shared files touched, and the remaining owner browser checks without claiming acceptance.
- [ ] 8.2 Leave isolated v3 staging deployment to a separate owner-authorized step so it can be sequenced against the concurrent Pack change; do not deploy, restart, or relink anything as part of this change.
