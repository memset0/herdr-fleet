## 1. Decisions and ground

- [x] 1.1 Record the coordinator's choice for each of design decisions 6 (dashboard tabs), 7 (composer), 8 (route and service worker) and 9 (command bar), and for decision 11 (no seam); if any choice differs from the recommendation, revise the affected delta specs and tasks with the update workflow before task 2.1; verify `openspec validate adopt-collie-1-14-2 --strict` passes after the revision
- [x] 1.2 Verify the local hooks are installed (`scripts/install-hooks.sh`), `main` is level with `origin/main`, and record the pre-change results of `bun run test:fork`, `bun test ./fleet` and `bun scripts/check-fork.ts`

## 2. Preflight

- [x] 2.1 Commit this change's planning artifacts on their own (explicit paths, planning-only); verify `git status --porcelain --untracked-files=all` prints nothing
- [x] 2.2 Obtain and record the owner's (or coordinator's) authorization to proceed with this change active, then run `bun scripts/check-fork.ts --target v1.14.2 --allow-active-changes`; verify tag object `5271116783decc927b84b4da9814d5fbef6277b7`, commit `887a37dbfc5582d08c7d7703deadd53146f654bb`, 20 disturbed entries, 3 untouched (`native-pane-chrome-port`, `private-fact-guard-port`, `downstream-docs`), no moved declared path, no owned-path collision. Without the authorization, stop
- [x] 2.3 Re-run `git merge-tree --write-tree --name-only HEAD v1.14.2`; verify the 35 conflicted paths match design.md's table, each attributed to its entry; stop and escalate any unattributed path

## 3. Open the merge

- [x] 3.1 Run `git merge --no-ff --no-commit v1.14.2`; verify `git rev-parse MERGE_HEAD` is `887a37dbfc5582d08c7d7703deadd53146f654bb` and every conflicted path is a predicted one

## 4. Resolve the contract conflicts

- [x] 4.1 `CLAUDE.md` stays the relative symlink to `AGENTS.md`; verify `test -L CLAUDE.md && [ "$(readlink CLAUDE.md)" = AGENTS.md ]` and no `CLAUDE.md~v1.14.2` remains
- [x] 4.2 `CHANGELOG.md` stays this product's plus one bold-lead Unreleased line for the adoption; `package.json`, `web/package.json` (with `sugar-high`), `herdr-plugin.toml` take upstream's content with `3.4.0`, this product's identity and the fork's ports; verify `bash scripts/check-version.sh` prints `✓` and no Collie entry entered `CHANGELOG.md`
- [x] 4.3 `COLLIE_CHANGELOG.md` becomes `v1.14.2`'s `CHANGELOG.md` verbatim per decision 11; verify the retention check in `bun scripts/check-fork.ts` passes and `cmp` against `git show v1.14.2:CHANGELOG.md` is clean
- [x] 4.4 `.oxlintrc.json` (parse-boundary override) and `bridge/removal-schedule.test.ts` (upstream's tombstone verbatim, the fork's `upstreamVersion` import removed, decision 10); verify `bun test bridge/removal-schedule.test.ts` and `bun run lint` on the file pass

## 5. Resolve the code conflicts

- [x] 5.1 Manual fit union (decision 5): `bridge/server.ts`, `bridge/crew/forward.ts`, `forward.test.ts`, `bridge/solo-baseline.test.ts`; verify `bun test bridge/crew/forward.test.ts bridge/solo-baseline.test.ts bridge/state-engine.test.ts bridge/sessions.test.ts` pass and `bash scripts/check-crew-wire.sh` accepts the staged pair
- [x] 5.2 Composer per decision 7 (`composer.tsx`, `composer-stt.test.tsx`, `composer.test.tsx`, `agent-chat.tsx`, `agent-chat.test.tsx`): record control in the box after attach, `hasDraft` kept, Send refusing on `!hasDraft || recorder.busy`, mic and type-mode command registrations kept, Display slot after Text size; status band switch, app-bar host chip and control-rank constants removed under B1; verify `cd web && bun run test composer composer-stt agent-chat display` and `bun test fleet/ui/mic-commands.test.ts fleet/ui/manual-pane-fit.test.ts` pass, including a chips-only draft accepting both controls
- [x] 5.3 Favorites and rows (`agent-list.tsx`, `agent-list.test.tsx`, `agent-card.tsx`, `agent-card.test.tsx`, `routes/home.test.tsx`, the seven dictionaries): upstream's file with the favorite port re-applied beside pins and hidden machines, the `ATTENTION` re-export dropped; verify `cd web && bun run test agent-list agent-card home i18n` and `bun test fleet/ui/agent-favorites.test.ts` pass
- [x] 5.4 Shell and routes (`routes/root.tsx` imports with `TourHost`, `routes/settings.tsx` fork group beside upstream's new cards, `motion.test.tsx` main-region scope, `routes/detail.tsx` `renderContent`, `routes/history.tsx` declined column, `tab-strip.tsx` actions slot, `test/handlers.ts`); verify `cd web && bun run test root settings motion detail history tab-strip` pass
- [x] 5.5 Service worker per decision 8: network-first route first, upstream's mount helpers, in-app open and progress plugin kept, precached-shell navigation route dropped; update `fleet/sw-boundary.test.ts` to the `PRECACHE_MANIFEST` form; verify `bun test fleet/sw-boundary.test.ts` passes and `__WB_MANIFEST` appears exactly once in `web/src/sw.ts`

## 6. Fork-side migration (its own commit after the merge commit's resolution)

- [x] 6.1 Trust reader (decision 2): remove the previous-name fallback, keep the write-refusing io, fail a legacy-only directory with upstream's notice; verify new `fleet/pack-authority.test.ts` cases for current-only, legacy-only (refused, file and name unchanged), both-present and neither, and that swapping in a writing io fails a case
- [x] 6.2 Enrolment: remove `migrateCrewStateOnce`, refuse a legacy-only directory with the same notice before opening the store; verify a `fleet/pack-enrollment.test.ts` case that leaves a legacy-only directory byte-for-byte unchanged and the protocol 2 enrolment case still passing
- [x] 6.3 State directory (decision 3): reset and set `COLLIE_STATE_DIR` to Fleet's Collie state directory; stop overriding `HERDR_PLUGIN_STATE_DIR` for the Collie child; verify a `fleet/collie-env.test.ts` case where upstream's `resolveStateDir(childEnv)` equals that directory from an environment carrying a foreign `COLLIE_STATE_DIR`, and `fleet/lifecycle.test.ts` passes
- [x] 6.4 Configuration files (decision 4): reset `COLLIE_BASE_PATH`; drop the `COLLIE_PACK_TIMEOUT_MS` reset; refuse a generation whose Collie home or instance `config.toml` sets a Fleet-owned name, reading both through upstream's own path resolver and reader; verify `fleet/collie-env.test.ts` cases with no file, a file with only non-owned keys, an owned key in each of the two files (refused, diagnostic names file and key, value absent), and an inherited base path
- [x] 6.5 Manual fit and clocks: drop the overlap assertions from `fleet/manual-pane-fit/capability.test.ts`; make `fleet/upstream-version.test.ts` assert one clock; verify both pass with `bun test cli/program.test.ts`
- [x] 6.6 Agent rail: import `ATTENTION` from `@/lib/triage`; verify `cd web && bun run test native-agent-rail native-navigation` and `bun test fleet/ui/native-navigation` pass, including a rail that still lists a machine hidden on the dashboard
- [x] 6.7 Docs: `docs/herdr-fleet.md` names the Fleet-owned Collie settings and the state-directory variable; `AGENTS.md`'s members paragraph drops the overlap description; verify `grep -rnE 'v1-overlap|state-migration|COLLIE_PACK_|REMOVE_IN_1_9_0' fleet web/src docs/herdr-fleet.md AGENTS.md` returns only deliberate mentions, both typechecks pass

## 7. Review every entry and record the boundary

- [x] 7.1 Set `[upstream]` to `v1.14.2`, tag object `5271116783decc927b84b4da9814d5fbef6277b7`, commit `887a37dbfc5582d08c7d7703deadd53146f654bb`; shrink `upstream-removal-clock` to `cli/program.test.ts`; correct reasons that cite the overlap, the composer band or the app-bar host chip; verify `bun scripts/check-fork.ts` reports no unclassified path and no stale anchor
- [x] 7.2 Review the 20 disturbed entries one at a time against design.md's table — keep, adapt, replace or drop — and run each entry's `verify` list; record any drop by returning its paths to upstream's versions; verify every listed test passes
- [x] 7.3 Review the 3 untouched entries (`native-pane-chrome-port` per decision 7, `private-fact-guard-port`, `downstream-docs`) for a reason upstream made unnecessary; verify each is deliberately kept, adapted or dropped
- [x] 7.4 Re-review the phase C2 ports of the previous adoption: the removal clock (now one), the docs-registry exclusion beside upstream's new docs page, the root/motion/smoke test scopes, and the two network-first e2e skips; verify each still applies or is removed
- [x] 7.5 Advance `reviewed = "v1.14.2"` on every remaining entry; verify the boundary check reports no lagging entry
- [x] 7.6 Add the `3.5.0` → `1.14.2` row to `UPSTREAM.md` and update its "currently corresponds to" lines; verify no version file moved
- [x] 7.7 One `CHANGELOG.md` line per functional commit; verify `bun run test:fork`, `bun scripts/check-private-facts.ts`, both typechecks and `bun run lint` pass

## 8. Verify

- [x] 8.1 Focused, locally: `bun run test:fork`, `bun test ./fleet`, the tests named in 4.x–6.x, `bash scripts/check-version.sh`, `bun scripts/check-private-facts.ts`, `bun run lint`, `bun run typecheck`, `cd web && bun run typecheck`; verify all pass
- [x] 8.2 Full suites on a designated member: bring its test tree to the merge commit, fetching this repository's branch and upstream's `v1.9.0`–`v1.14.2` tag objects from upstream's public repository; run `bun run test` at the root, `cd web && bun run test`, `bun test ./cli` and the `scripts/` shell suites; verify they pass, triaging any failure against the pre-merge baseline and the known exit/hang issues owned by other changes rather than skipping it
- [x] 8.3 Browser tier locally: `cd web && bun run e2e` (Chromium; WebKit with `COLLIE_E2E_WEBKIT=1` only where the host supports it); verify it passes, or report each failing case with the port it meets — including `update-screen.spec.ts` against network-first navigation and the new dashboard-footer, belt and composer-clear specs. Do not rewrite an upstream case without declaring it
- [x] 8.4 Upstream's crew suites (`bun test bridge/crew/`) and `scripts/release-notes.test.ts` (expected to clear only after the release bump); verify they pass or are triaged
- [x] 8.5 Public-tree audit: verify the staged diff and this change's artifacts carry no private host, address, path, credential, mesh name or parent-tooling name, and `FORK.toml` classifies every changed path
- [x] 8.6 Rollback probe in a scratch state directory: start a 3.4.0 Collie against a state directory a 3.5.0 Collie has written (trust store present); verify it starts in the same crew mode with no file rename needed, or stop and report it at 9.2

## 9. Release

- [x] 9.1 Read the newest tag on the remote (`git ls-remote --tags origin`); verify it is still `v3.4.0` (else cut the MINOR after it)
- [x] 9.2 Re-assess the axis (design decision 12): if an operator step appeared, the coordinator ruled the config-file refusal breaking, or 8.6 failed, stop and report instead of cutting; otherwise confirm MINOR 3.4.0 → 3.5.0
- [x] 9.3 Commit the merge with both parents; verify `git log -1 --format=%P` names the previous `main` head and `887a37dbfc5582d08c7d7703deadd53146f654bb`
- [x] 9.4 Cut `chore(release): 3.5.0` — the three version files, `## [3.5.0] - <date>` with each line's short hash, a fresh empty Unreleased heading, notes stating every member redeploys lead first, no configuration edit, and the Fleet-owned Collie settings rule; verify `bash scripts/check-version.sh` prints `✓` and `scripts/release-notes.test.ts` passes
- [x] 9.5 `git tag -a v3.5.0 -m "Herdr Fleet 3.5.0"` and `git push origin main v3.5.0` (tag named on the push line; never `--follow-tags` or `--tags`; no GitHub Release); verify `git ls-remote --tags origin` shows `v3.5.0` and no upstream `v1.x` tag, and `bash scripts/check-tag.sh` is clean

## 10. Hand-off

- [x] 10.1 Report the Migration Plan to the operator; verify the report states the push is not a completed adoption
- [x] 10.2 Archive only after the operator reports the lead and the designated member on 3.5.0, lead first, with Collie's crew mode and member id unchanged (design decision 13); verify `openspec validate adopt-collie-1-14-2 --strict` passes before archiving — done 2026-10-01: the operator deployed 3.5.0 to the lead, then to the one remaining member; both report `3.5.0+60f94efc` reachable (see design "Adoption record")
