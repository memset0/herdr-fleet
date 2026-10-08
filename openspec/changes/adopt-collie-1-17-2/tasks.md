## 1. Ground

- [x] 1.1 Verify the hooks are installed (`core.hooksPath` = `scripts/git-hooks`), `main` is `origin/main` plus only the `refine-todoist-tree-ui` archive commit, and record the pre-change `bun run test:fork` and `bun test ./fleet` results
- [x] 1.2 Commit this change's planning artifacts on their own (explicit paths); verify that `openspec validate adopt-collie-1-17-2 --strict` passes and the tree is clean

## 2. Preflight

- [x] 2.1 With the owner's authorization (design decision 1), run `bun scripts/check-fork.ts --target v1.17.2 --allow-active-changes`; verify tag object `b73f66bcafd40b75adc93abc838c7e5c49c30d00`, commit `3d562ae5f8ca1b5bcbf8c4cab10064c955d5c704`, 21 disturbed and 8 untouched entries, no owned path occupied, and this change listed
- [x] 2.2 Verify that `git merge-tree` gives the 19 conflicted paths in design.md's table; stop and escalate any unattributed path

## 3. Merge

- [x] 3.1 Run `git merge --no-ff --no-commit 'v1.17.2^{commit}'`; verify `MERGE_HEAD` is `3d562ae5f8ca1b5bcbf8c4cab10064c955d5c704`
- [x] 3.2 Resolve the contract paths: `CLAUDE.md` stays the symlink; `CHANGELOG.md` is ours plus one Unreleased line; the version files keep `3.9.14`; `COLLIE_CHANGELOG.md` has `v1.17.2`'s changelog as its prefix (decision 7); `check-version.sh` prints ✓
- [x] 3.3 Resolve the code paths per decisions 2–4; verify no conflict marker remains
- [x] 3.4 Run `bun install` at the root and in `web/`; verify neither lockfile changes
- [x] 3.5 Commit the merge with `git commit -F`; verify its parents are the planning commit and `3d562ae5…`

## 4. Retire the Claude port and migrate

- [x] 4.1 Run the fork's manage-hint working-screen and dialog cases against upstream's reading and record each result in design decision 2; report any unexpected failure to the owner
- [x] 4.2 Remove `web/src/lib/fleet-claude-mode-line.ts`, `web/src/lib/harness/claude/fleet-manage-hint.test.ts`, the four `claude--*manage-hint*` fixtures, the `claude-mode-line-compat` owned entry and the `claude-manage-hint-port` invasive entry; verify `cd web && bunx vitest run src/lib/harness` passes
- [x] 4.3 Chat gate (decision 3): verify that `cd web && bunx vitest run src/components/agent-chat src/components/fleet-pane-route` passes, including the terminal-surface case with Chat chosen
- [x] 4.4 Commit with an explicit pathspec and one `CHANGELOG.md` line

## 5. Review every entry and record the boundary

- [ ] 5.1 Set `[upstream]` to `v1.17.2`; verify `bun scripts/check-fork.ts` reports no unclassified path and no stale anchor
- [ ] 5.2 Review all remaining entries (keep, adapt, replace or drop), run each entry's bun and vitest `verify` files (browser tier excepted), and record the decisions table here
- [ ] 5.3 Advance `reviewed = "v1.17.2"` on every entry; add the `UPSTREAM.md` row `3.10.0` → `1.17.2`; verify no version file moved
- [ ] 5.4 Verify that `bun run test:fork`, `check-private-facts`, both typechecks, `bun run lint`, the build and `bun test ./fleet` pass; commit with an explicit pathspec

## 6. Verify (phase C, on a designated member — not in this phase)

- [ ] 6.1 Full suites: root `bun run test`, `cd web && bun run test`, `bun run test:crew`, and the shell suites
- [ ] 6.2 Browser tier: run `cd web && bun run e2e`, and settle any case that meets a port
- [ ] 6.3 UI check: Chat default and the terminal surface, Resize on the mirror's Display rows, the Files view and Machines page through the Gateway and across a member
- [ ] 6.4 Run the rollback probe and the public-tree audit

## 7. Release (later phase)

- [ ] 7.1 Read the remote's newest tag; cut `chore(release): 3.10.0` (MINOR); tag `v3.10.0`; push the branch with the tag named on the push line, never `--follow-tags`

## 8. Hand-off

- [ ] 8.1 Archive only after the operator reports the lead and the remaining member on 3.10.0, lead first
