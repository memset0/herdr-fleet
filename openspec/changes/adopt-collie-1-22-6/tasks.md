## 1. Ground

- [x] 1.1 Verify hooks are installed, `main` equals `origin/main`, and record `bun run test:fork` (1001 owned, 70 invasive)
- [x] 1.2 Commit the planning artifacts alone (explicit paths); verify `openspec validate adopt-collie-1-22-6 --strict` and a clean tree

## 2. Preflight and merge

- [x] 2.1 Run `bun scripts/check-fork.ts --target v1.22.6 --allow-active-changes` (this change is the only active one); verify tag object `a2ada8ff…`, commit `9cc40c8a…`, 28 disturbed / 2 untouched, no owned path occupied
- [x] 2.2 `git merge --no-ff --no-commit 'v1.22.6^{commit}'`; verify `MERGE_HEAD` is `9cc40c8a3e75e9547e711d52d49bf5c1dd7d2aba`
- [x] 2.3 Resolve the contract paths (`CLAUDE.md` symlink, `CHANGELOG.md`, version files at 3.16.x, `herdr-plugin.toml`, `COLLIE_CHANGELOG.md` prefix, pre-commit hook); `check-version.sh` prints ✓
- [x] 2.4 Resolve every code conflict and record each in the design; `markers.ts` takes upstream's text; no conflict marker remains; `bun install` checked for lockfile changes
- [x] 2.5 Commit the merge with `git commit -F`; verify its second parent is `9cc40c8a…`

## 3. Reader ports retired

- [x] 3.1 Remove the Codex status-row helper, its suite and fixtures and the `codex-status-row-compat` owned entry; `invariants.test.ts` returns to upstream's text; the invasive entry is dropped
- [x] 3.2 Confirm no other fork change remains under the Claude/Codex harness readers or their send paths

## 4. Send pipeline, crew and Gateway

- [x] 4.1 Fork composer, task composer, keyboard commands, microphone beside Send, Keys/Type controls on upstream's new send path; focused suites pass
- [x] 4.2 Crew forward port reconciled with upstream's send protocol; focused suites pass
- [x] 4.3 Gateway passes upstream's new routes and headers, still refuses pairing and device revocation; CSP augmentation still composes; focused cases

## 5. Themes, hooks, durable agents, build

- [ ] 5.1 Fleet shell, fonts and density markers under the default theme unchanged and under the other themes legible
- [x] 5.2 Hooks and durable agents: Fleet enables neither; record the bridge's behaviour without them
- [x] 5.3 Main script under the service worker's precache limit; Bun floor; release drift gate against the fork's publication rule

## 6. Review every entry and record the boundary

- [x] 6.1 Set `[upstream]` to `v1.22.6`; review every invasive entry with its verify list; record the decisions table in the design
- [x] 6.2 Advance `reviewed = "v1.22.6"`; add the `UPSTREAM.md` row; record check-fork counts before and after
- [ ] 6.3 Both typechecks, lint, `test:fork`, `test:fleet`, `check-private-facts`, focused suites; commit with explicit pathspecs and Unreleased lines

## 7. Verify

- [ ] 7.1 Run the full suites on the designated member; classify every failure against the 3.16.3 baseline
- [ ] 7.2 Headless Chromium: default and Nightwatch at desktop and phone widths, dashboard, pane Chat, composer
- [x] 7.3 Real-pane Codex and Claude Code verification: withdrawn by the owner, who verifies those panes; nothing re-added

## 8. Release and level

- [ ] 8.1 Read the remote's newest tag; cut `chore(release): 3.17.0`; annotated tag `v3.17.0`, pushed by name
- [ ] 8.2 Level the lead, then each member; verify the census, the Gateway path (snapshot, a send to a throwaway shell on the lead and a member, pairing refusal); close the throwaway workspaces

## 9. Archive

- [ ] 9.1 Sync specs, validate, archive, commit and push
