## 1. Ground

- [x] 1.1 Verify the local hooks are installed (`core.hooksPath` = `scripts/git-hooks`), `main` is level with `origin/main`, and record the pre-change results of `bun run test:fork` and `bun test ./fleet`
- [x] 1.2 Commit this change's planning artifacts on their own (explicit paths, planning-only); verify `openspec validate adopt-collie-1-15-0 --strict` passes and `git status --porcelain --untracked-files=all` prints nothing

## 2. Preflight

- [x] 2.1 With the owner's authorization recorded in design decision 1, run `bun scripts/check-fork.ts --target v1.15.0 --allow-active-changes` and save its output to the scratchpad; verify tag object `1dba7de34afa9334a185f85e8f1d1947f4f723c3`, commit `ef01b0ed4d9271897413984075aa6d2060ffcf2a`, 19 disturbed, 6 untouched, no moved declared path, no owned-path collision, this change listed
- [x] 2.2 Re-run `git merge-tree --write-tree --name-only HEAD v1.15.0`; verify the 16 conflicted paths match design.md's table, each attributed to its entry; stop and escalate any unattributed path

## 3. Merge

- [x] 3.1 `git merge --no-ff --no-commit 'v1.15.0^{commit}'`; verify `MERGE_HEAD` is `ef01b0ed4d9271897413984075aa6d2060ffcf2a` and every conflicted path is a predicted one
- [x] 3.2 Contract paths: `CLAUDE.md` stays the symlink (no `CLAUDE.md~…` left); `CHANGELOG.md` ours plus one bold-lead Unreleased line; `package.json`, `web/package.json`, `herdr-plugin.toml` keep `3.5.3` and this product's identity; `COLLIE_CHANGELOG.md` is `v1.15.0`'s changelog; verify `bash scripts/check-version.sh` prints `✓` and `cmp` against `git show v1.15.0:CHANGELOG.md` is clean
- [x] 3.3 Code paths per design decision 1's table (crew/server union with `chat`, composer and its test upstream's, Display slot and Resize row in the sheet, settings index with the fork group, worker imports, Codex normaliser on `splitPaintedGaps`); verify no conflict marker remains in any of the 16 paths
- [x] 3.4 `bun install` at the root and in `web/`; verify neither lockfile changes
- [x] 3.5 Commit the merge with `git commit -F` (no pathspec — the merge exception); verify `git log -1 --format=%P` names the previous `main` head and `ef01b0ed4d9271897413984075aa6d2060ffcf2a`

## 4. Fork-side migration

- [x] 4.1 Codex helper (decision 2): non-null signature, suite updated with the upstream-cut pair case; verify `cd web && bunx vitest run src/lib/harness` passes and the root typecheck is clean again
- [x] 4.2 Chat gate (decision 4): `chatOffered` requires no content renderer; fork cases for the terminal surface with Chat chosen and for Resize absent from Chat's rows; the fork's manual-fit cases close the Display sheet by its Close control; verify `cd web && bunx vitest run src/components/agent-chat` passes and the terminal-surface case fails with the gate removed
- [x] 4.3 Settings (decision 5): `settings-page.tsx` loses its cap and header claim; upstream's index test counts only Collie's controls; verify `cd web && bunx vitest run src/routes/settings src/components/fleet-settings` passes
- [x] 4.4 Upstream-test collisions (decision 6): the 1.15.0 credit case reads `COLLIE_CHANGELOG.md`; the capability test expects `tuios: false`; verify `bun test scripts/release-notes.test.ts fleet/manual-pane-fit/capability.test.ts` passes
- [x] 4.5 Docs: `docs/herdr-fleet.md` places Resize in the terminal view's Display sheet and names Settings → Alerts; one `CHANGELOG.md` line; `FORK.toml` paths and anchors moved with the boundary (settings-page, settings test, composer anchor, composer test dropped, Codex anchor, release-notes reason); commit with an explicit pathspec

## 5. Review every entry and record the boundary

- [x] 5.1 Set `[upstream]` to `v1.15.0`, tag object `1dba7de34afa9334a185f85e8f1d1947f4f723c3`, commit `ef01b0ed4d9271897413984075aa6d2060ffcf2a`; verify `bun scripts/check-fork.ts` reports no unclassified path and no stale anchor
- [x] 5.2 Review the 19 disturbed entries one at a time — keep, adapt, replace or drop — and run each entry's `verify` list (browser-tier files excepted, which stay with phase C); verify every listed test passes
- [x] 5.3 Review the 6 untouched entries for a reason upstream made unnecessary; verify each is deliberately kept, adapted or dropped
- [x] 5.4 Advance `reviewed = "v1.15.0"` on every remaining entry and record the decisions table in design decision 12; verify the boundary check reports no lagging entry
- [x] 5.5 Add the `3.6.0` → `1.15.0` row to `UPSTREAM.md` and update its "currently corresponds to" lines; verify no version file moved
- [x] 5.6 Verify `bun run test:fork`, `bun scripts/check-private-facts.ts`, `bun run typecheck`, `cd web && bun run typecheck`, `bun run lint` and `bun test ./fleet` pass; commit `chore(fork): review every port against Collie v1.15.0` with an explicit pathspec

## 6. Verify (phase C)

- [x] 6.1 Full suites on a designated member: root `bun run test`, `cd web && bun run test`, `bun test ./cli`, the `scripts/` shell suites and `bun run test:crew`; verify they pass, triaging any failure against the pre-merge baseline and the known exit/hang issues owned by other changes
- [x] 6.2 Browser tier: `cd web && bun run e2e`; verify it passes, or settle each failing case in the port it meets and declare it in `FORK.toml` — including `pair-landing.spec.ts`, `m24-crew.spec.ts` and any case that meets the rails, the Settings index or the Display sheet
- [x] 6.3 UI check on a scratch build: the Display sheet (Resize below Text size on the mirror, absent on Chat), the Settings index (Fleet group first, full width) and a section, Chat under the mirror and no Chat switch under the terminal surface, Copy output, the boot splash marks
- [x] 6.4 Rollback probe in scratch directories: a 3.5.3 Collie starts against state a 3.6.0 Collie wrote, in the same crew mode with the same ids
- [x] 6.5 Public-tree audit: the commits and this change's artifacts carry no private host, address, path, credential, mesh name or parent-tooling name; `FORK.toml` classifies every changed path

## 7. Release

- [x] 7.1 Read the newest tag on the remote (`git ls-remote --tags origin`); verify it is still `v3.5.3` (else cut the MINOR after it)
- [x] 7.2 Cut `chore(release): 3.6.0` — the three version files, `## [3.6.0] - <date>` with each line's short hash, a fresh empty Unreleased heading, notes stating every member redeploys lead first and no configuration edit; verify `bash scripts/check-version.sh` prints `✓` and `scripts/release-notes.test.ts` passes
- [x] 7.3 `git tag -a v3.6.0 -m "Herdr Fleet 3.6.0"` and `git push origin main v3.6.0` (tag named on the push line; never `--follow-tags` or `--tags`; no GitHub Release); verify `git ls-remote --tags origin` shows `v3.6.0` and no upstream `v1.x` tag

## 8. Hand-off

- [x] 8.1 Report the Migration Plan to the operator; verify the report states the push is not a completed adoption
- [x] 8.2 Archive only after the operator reports the lead and the remaining member on 3.6.0, lead first; verify `openspec validate adopt-collie-1-15-0 --strict` passes before archiving
