## 1. Make the preflight rename-aware (prerequisite)

- [x] 1.1 Verify the local hooks are installed (`scripts/install-hooks.sh`) and that `main` is level with `origin/main`; record the pre-change results of `bun test scripts/check-fork.test.ts` and `bun scripts/check-fork.ts`
- [x] 1.2 Add a pure parser for `git diff --name-status --find-renames` output that returns the changed set (both sides of every rename) and a `source → destination` map; verify with parser cases over `R`, `A`, `M`, `D` and `T` rows in `scripts/check-fork.test.ts`
- [x] 1.3 Switch `preflightInput` to that invocation, carry the rename map into `PreflightInput`, report each disturbed entry's moved paths with their destinations, and print `declared → destination` in the CLI; verify a `planUpstreamAdoption` case where an entry declares only a renamed path and is reported disturbed with its destination
- [x] 1.4 Add one sandboxed-repository test (isolated global/system Git config, no network) with a baseline commit and an annotated target tag that renames a declared file, run `preflightInput` with `diff.renames` false, true and unset, and verify all three reports are identical and include the declared path
- [x] 1.5 Add one `CHANGELOG.md` Unreleased line and commit the fix on its own with explicit paths; verify `bun run test:fork`, `bun run lint` and `bun run typecheck` pass (the report on the real target is checked in 2.2, once the tree is clean)

## 2. Preflight

- [x] 2.1 Empty the untracked set by the owner's chosen means for the two parked changes (`preserve-terminal-replay-state`, `fix-stt-test-exit`) — committed as planning-only work, or moved out of the tree for the duration — and commit this change's planning artifacts; verify `git status --porcelain --untracked-files=all` prints nothing
- [x] 2.2 Run `bun scripts/check-fork.ts --target v1.8.2 --allow-active-changes`, the flag stating the owner's 2026-09-30 authorization to proceed with the active changes; verify it reports tag object `5bfd5b97…`, commit `78f74d1e…`, 20 disturbed entries, 1 untouched (`authenticated-navigation-cache`), no owned-path collision, and `bridge/pack/forward.ts`, `bridge/pack/forward.test.ts`, `PACK_PROTOCOL.md` and `web/src/routes/pack.tsx` listed with their crew destinations
- [x] 2.3 Re-run `git merge-tree --write-tree --name-only HEAD v1.8.2` and verify the conflict list still matches design.md's 23 paths, each attributed to an entry; stop and escalate any unattributed path

## 3. Open the merge

- [x] 3.1 Run `git merge --no-ff --no-commit v1.8.2`; verify `git rev-parse MERGE_HEAD` is `78f74d1e3d1638a8e7889e58c610726582bafd1b` and every conflicted path is one of the predicted ones (report any extra, with its entry)

## 4. Resolve the contract conflicts

- [x] 4.1 `CLAUDE.md` stays the relative symlink to `AGENTS.md` and upstream's regular file is not read into it; verify `test -L CLAUDE.md && [ "$(readlink CLAUDE.md)" = AGENTS.md ]` and no `CLAUDE.md~v1.8.2` remains
- [x] 4.2 `CHANGELOG.md` stays this product's, plus one Unreleased line for the adoption; `package.json`, `web/package.json`, `herdr-plugin.toml` take upstream's content with `3.3.0`, this product's identity and the fork's ports intact; verify `bash scripts/check-version.sh` prints `✓` and no Collie entry entered `CHANGELOG.md`
- [x] 4.3 `COLLIE_CHANGELOG.md` becomes `v1.8.2`'s `CHANGELOG.md` verbatim with no seam (no retained heading was dropped); verify the retention check inside `bun scripts/check-fork.ts` passes
- [x] 4.4 `.gitignore` (`/fleet.toml`), `.oxlintrc.json` (parse-boundary override), `scripts/git-hooks/pre-commit` and `scripts/pre-commit.test.sh` (privacy guard D beside upstream's renamed crew-wire guard C and its `SKIP_CREW_WIRE_CHECK` hatch): upstream's file with the port re-applied; verify `bash scripts/pre-commit.test.sh` and `bun test scripts/check-private-facts.test.ts` pass

## 5. Resolve the code conflicts

- [x] 5.1 `bridge/mux/herdr/adapter.ts`: keep the `viewportRows` capture and upstream's `pane.revision`; `bridge/index.ts`: re-apply the `manualPaneFit` wiring onto upstream's crew wiring; verify `bun test bridge/state-engine.test.ts bridge/sessions.test.ts` and the Herdr adapter tests pass
- [x] 5.2 `bridge/crew/forward.ts`/`forward.test.ts` and `CREW_PROTOCOL.md`: re-apply the resize route on the crew router and document `POST /crew/v1/pane/:id/resize` in the §5 table; verify `bun test bridge/crew/forward.test.ts bridge/solo-baseline.test.ts` pass and `bash scripts/check-crew-wire.sh` accepts the staged pair
- [x] 5.3 `composer.tsx`, `display-prefs.tsx`, `agent-chat.tsx` and its test: upstream's files with the split record/Send controls, mic refusal table, keyboard-command registration, status-word and host switches, Display slot (`Resize` directly below `Text size`, beside upstream's clipped-reply row) and content-renderer port re-applied, and `useMuxCapability("resizePane", scope)`; verify `cd web && bun run test composer composer-stt agent-chat display` and `bun test fleet/ui/mic-commands.test.ts fleet/ui/manual-pane-fit.test.ts` pass
- [x] 5.4 `docs/voice-and-push.md`: keep the fork's two-button paragraph inside upstream's restructured page; verify the sentence the port exists to correct is absent and `composer-stt.test.tsx`'s "stands beside Send" case passes
- [x] 5.5 `app-header.tsx`, `routes/root.tsx` (navigation shell), `lib/loaders.ts` (unnarrowed rows and version evidence via `fetchCrew`), `lib/api.ts` (resize and release ports beside upstream's `fetchCrew`), `agent-list.test.tsx` (favorites): upstream's file with the port re-applied; verify `cd web && bun run test app-header loaders agent-list home` and `bun test fleet/ui/native-navigation fleet/ui/version-evidence.test.ts` pass

## 6. Move the fork onto crew naming and protocol version 2

- [x] 6.1 Re-point every fork import and symbol upstream renamed (`bridge/crew/*`, `CREW_PROTOCOL_VERSION`, `CREW_ENROLL_PATH`, `crewRouteFor`, `CrewProvider`/`useCrew`/`useHostWriteBlock`, `crewId`/`crew` in trust data) in `fleet/` and the fleet/native web components and tests listed in design.md; verify `grep -rnE 'bridge/pack|PACK_PROTOCOL|pack-provider|packRouteFor|PACK_ENROLL' fleet web/src scripts docs/herdr-fleet.md` returns nothing and both typechecks pass
- [x] 6.2 Trust reader: read `crew-trust.json` through Collie's reader, else the legacy file read-only through Collie's parser, current name winning; verify new `fleet/pack-authority.test.ts` cases for legacy-only, both-present and neither-present state directories, each leaving the files byte-for-byte unchanged and in place
- [x] 6.3 Enrolment: run upstream's one-time state move before the store opens; verify a `fleet/pack-enrollment.test.ts` case that starts from a legacy-named store ends with one crew-named store and no legacy file, and that the enrolment request carries protocol 2 to `/crew/v1/enroll`
- [x] 6.4 Environment: reset `COLLIE_CREW_TIMEOUT_MS` and `COLLIE_PACK_TIMEOUT_MS`, set only the crew key, keep the `[pack]` section; verify `fleet/collie-env.test.ts` and `fleet/config.test.ts` cover a stated budget, an omitted section and an inherited old-name value
- [x] 6.5 Gateway: deny `/crew/` as well as `/pack/`; verify `fleet/gateway.test.ts` refuses `/crew/v1/hello`, `/crew/v1/snapshot`, `/crew/v1/pane/p1/reply` and `/crew/v1/enroll` with 404 without contacting Collie, and still serves `/crew`
- [x] 6.6 Manual fit across the overlap: in `fleet/manual-pane-fit/capability.test.ts`, assert the resize route is in the crew route table, that `/pack/v1/pane/:id/resize` routes to it through upstream's version 1 translation, and that the fallback path for a crew resize is `/pack/v1/pane/:id/resize`; verify it passes along with `web/src/lib/mux-capability.test.ts` for a member answer that differs from the lead's and one that is absent
- [x] 6.7 Update `docs/herdr-fleet.md` and the `AGENTS.md` references the rename made false (design decision 3), plus the one-line browser-tier rule; verify `grep -nE 'PACK_PROTOCOL|SKIP_PACK_WIRE|check-pack-wire|bridge/pack|pack-ops\.json|/pack/v1|packVersion' AGENTS.md docs/herdr-fleet.md` returns only deliberate mentions of the previous prefix

## 7. Review every entry and record the boundary

- [x] 7.1 Set `[upstream]` to `v1.8.2`, tag object `5bfd5b9707ee5f4ea64b6ee05eda51b7a4264fac`, commit `78f74d1e3d1638a8e7889e58c610726582bafd1b`, and apply design decision 7's path renames and reason corrections; verify `bun scripts/check-fork.ts` reports no unclassified path and no stale anchor
- [x] 7.2 Review the 20 disturbed entries one at a time — keep, adapt, replace or drop — and run each entry's `verify` list; verify every listed test passes and record any drop by returning its paths to upstream's versions
- [x] 7.3 Review `authenticated-navigation-cache` for a reason upstream made unnecessary (including its service worker's version 1 denylist line); verify it is deliberately kept or dropped
- [x] 7.4 Advance `reviewed = "v1.8.2"` on all 21 entries (fewer if any was dropped); verify the boundary check no longer reports a lagging entry
- [x] 7.5 Add the `3.4.0` → `1.8.2` row to `UPSTREAM.md` and update its "currently corresponds to" lines; verify no version file moved in this step

## 8. Verify

- [ ] 8.1 Focused, locally: `bun run test:fork`, `bun test ./fleet`, the tests named in 5.x–6.x, `bash scripts/check-version.sh`, `bun scripts/check-private-facts.ts`, `bun run lint`, `bun run typecheck` and `cd web && bun run typecheck`; verify all pass
- [ ] 8.2 Full suites on a designated member (`bun run test` at the root, `cd web && bun run test`, `bun test ./cli`, the `scripts/` shell suites); verify they pass, and triage any failure against the pre-merge baseline and the known web-suite exit issue owned by `fix-stt-test-exit` rather than skipping it
- [ ] 8.3 Upstream's browser tier: run `cd web && bun run e2e` where Chromium is available; verify it passes, or report each failing case with the port it meets and whether it failed before the merge. Do not rewrite an upstream e2e case without declaring it
- [ ] 8.4 Run upstream's crew suites that dial in both protocol versions (`bun test bridge/crew/harness.test.ts bridge/crew/peer-client.test.ts bridge/crew/router.test.ts bridge/crew/state-migration.test.ts`) with the resize route present; verify they pass. Mixed-release proof on real machines belongs to the operator's rollout, not to this task
- [ ] 8.5 Public-tree audit: verify the staged diff and this change's artifacts carry no private host, address, path, credential or deployment fact, and `FORK.toml` classifies every changed path

## 9. Release

- [ ] 9.1 Read the newest tag on the remote (`git ls-remote --tags origin`); verify it is still `v3.3.0` (else cut the MINOR after it)
- [ ] 9.2 Re-assess the axis from the sum of the Unreleased entries: if the configuration section or any operator step changed during apply, or the owner has ruled the rollback or census consequence MAJOR, stop and report instead of cutting; otherwise confirm MINOR 3.3.0 → 3.4.0
- [x] 9.3 Commit the merge with both parents; verify `git log -1 --format=%P` names the previous `main` head and `78f74d1e3d1638a8e7889e58c610726582bafd1b`
- [ ] 9.4 Cut `chore(release): 3.4.0` — the three version files, `## [3.4.0] - <date>` with each line's short hash, a fresh empty Unreleased heading, and release notes stating that every member must redeploy, lead first, before any release that adopts Collie `v1.9.0`; verify `bash scripts/check-version.sh` prints `✓`
- [ ] 9.5 `git tag -a v3.4.0 -m "Herdr Fleet 3.4.0"` and `git push origin main v3.4.0` (tag named on the push line; never `--follow-tags` or `--tags`; no GitHub Release); verify `git ls-remote --tags origin` shows `v3.4.0` and no upstream `v1.x` tag, and `bash scripts/check-tag.sh` is clean

## 10. Hand-off

- [ ] 10.1 Report to the operator the deployment-side changes in design.md's Migration Plan and the release's member obligations; verify the report states the push is not a completed adoption
- [ ] 10.2 Archive only after the operator reports every member on 3.4.0 through the new link (design decision 10); verify `openspec validate adopt-collie-1-8-2 --strict` passes before archiving
