## 1. Ground

- [x] 1.1 Verify hooks are installed, `main` equals `origin/main`, and record `bun run test:fork` (21 pass; 968 owned, 69 invasive)
- [x] 1.2 Commit the planning artifacts alone (explicit paths); verify `openspec validate adopt-collie-1-20-1 --strict` and a clean tree

## 2. Preflight and merge

- [x] 2.1 Run `bun scripts/check-fork.ts --target v1.20.1 --allow-active-changes` (this change is the only active one); verify tag object `f8ce7bd4…`, commit `3c08e4f2…`, 17 disturbed / 13 untouched, no owned path occupied
- [x] 2.2 `git merge --no-ff --no-commit 'v1.20.1^{commit}'`; verify `MERGE_HEAD` is `3c08e4f25d51a2dd62e3cb44d3f71850afd69557`
- [x] 2.3 Resolve the contract paths (`CLAUDE.md` symlink, `CHANGELOG.md`, version files at 3.15.6, `herdr-plugin.toml`, `COLLIE_CHANGELOG.md` prefix); `check-version.sh` prints ✓
- [x] 2.4 Resolve every code conflict (`agent-chat.tsx`, `chat-cards.tsx`, `composer.tsx`, `sw.ts`, `sw-routes.test.ts`) and record each in the design; no conflict marker remains; `bun install` changes neither lockfile
- [x] 2.5 Commit the merge with `git commit -F`; verify its second parent is `3c08e4f2…`

## 3. Voice

- [x] 3.1 `web/src/lib/fleet-voice-finish.ts` and the one wrapped call in `use-voice-levels.ts`; fork test proving no finish and no ring on silence in a Fleet build, OK and the bin still ending a clip, and upstream's detector outside a Fleet build
- [x] 3.2 Record control beside Send when idle and the recorder bar over the composer while recording; `composer-stt.test.tsx`, `mic-commands`, `fleet-task-composer` suites pass
- [x] 3.3 Gateway: the document policy widening keeps every directive of the adopted page policy; the phone engine's worker/wasm/model routes and the host speech routes pass the proxy (focused cases); record findings in the design

## 4. Service worker and overlaps

- [x] 4.1 `sw.ts`: fork network-first navigation with cached-shell fallback kept, upstream's takeover, cleanup and reload-once adopted; `fleet/sw-boundary`, `fleet-navigation`, `sw-routes` suites pass
- [x] 4.2 Confirm the Gateway's pairing label passes 1.20's name rule, the removed worktree routes and web pieces have no fork caller, and the three upstream PR ports are still needed

## 5. Review every entry and record the boundary

- [x] 5.1 Set `[upstream]` to `v1.20.1`; review every invasive entry with its verify list; record the decisions table in the design
- [x] 5.2 Advance `reviewed = "v1.20.1"`; add the `UPSTREAM.md` row; record check-fork counts before and after
- [x] 5.3 Both typechecks, lint, `test:fork`, `test:fleet`, `check-private-facts`, focused suites; commit with explicit pathspecs and Unreleased lines

## 6. Verify

- [x] 6.1 Push `main` unreleased (`SKIP_TESTS=1`); run the full suites against that commit on the designated member; classify every failure against the 3.15.6 baseline
- [x] 6.2 Headless Chromium on a local Fleet build: composer idle (record control beside Send), the recorder bar while recording with no finish on silence, Settings → Voice, at desktop and phone widths, light and dark

## 7. Release and level

- [ ] 7.1 Read the remote's newest tag; cut `chore(release): 3.16.0`; annotated tag `v3.16.0`, pushed by name
- [ ] 7.2 Level the lead, then each member; verify the census, the Gateway path (snapshot, a write on the lead and a member, Settings → Voice, pairing refusal); close the throwaway workspaces

## 8. Archive

- [ ] 8.1 Sync specs, validate, archive, commit and push

## Phase record

- 6.1 Full suites on the designated member at `3ce37c69` (reached by bundle before any push), Bun 1.4.2:
  both typechecks, full lint, `test:fork` (981 owned / 70 invasive), version, cli 2048 / 0, scripts
  281 / 0, fleet 735 / 0, crew 66 / 0, bridge file by file 182 files all clean, every shell suite,
  web 442 files: 24395 pass / 32 expected fail / 49 todo, no failure, build. The first run at
  `925f97f2` had the same results except the build, which failed: the main script (2.11 MB) crossed
  the worker's 2 MiB precache limit; the lazy terminal chunk fixed it (1.76 MB). Locally: upstream's
  browser cases `voice-takeover`, `stt-phone`, `stt-worker-csp` and `service-worker` pass on the phone
  project (the two `service-worker` skips are the fork's declared ones).
- 6.2 Headless Chromium on a local Fleet build with stubbed routes and a synthetic microphone, at
  1600×900 and 390×844, light and dark: the record control stands beside Send; the recorder bar covers
  the composer with OK on the record control's exact centre and the bin at the far end; after speech
  and 4.5 s of quiet the clip is still listening, the ring is hidden and OK is live; Settings → Voice
  and Host speech render inside the Fleet shell, the setup line naming the Gateway's device label.
