## 1. Ground

- [ ] 1.1 Verify hooks are installed, `main` equals `origin/main`, and record `bun run test:fork` (21 pass; 910 owned, 69 invasive)
- [ ] 1.2 Commit the planning artifacts alone (explicit paths); verify `openspec validate adopt-collie-1-19-0 --strict` and a clean tree

## 2. Preflight and merge

- [ ] 2.1 Run `bun scripts/check-fork.ts --target v1.19.0 --allow-active-changes`; verify tag object `35d8c000…`, commit `632a2bf7…`, 13 disturbed / 13 untouched, no owned path occupied, this change listed
- [ ] 2.2 `git merge --no-ff --no-commit 'v1.19.0^{commit}'`; verify `MERGE_HEAD` is `632a2bf784045b1e2576da112d89ed21fecc9eeb`
- [ ] 2.3 Resolve the contract paths (`CLAUDE.md` symlink, `CHANGELOG.md`, version files at 3.14.0, `herdr-plugin.toml`, `COLLIE_CHANGELOG.md` prefix); `check-version.sh` prints ✓
- [ ] 2.4 Resolve every code conflict (`agent-chat.tsx`, `router.tsx`, deleted `new-space-sheet.tsx`) and record each in the design; no conflict marker remains; `bun install` changes neither lockfile
- [ ] 2.5 Commit the merge with `git commit -F`; verify its second parent is `632a2bf7…`

## 3. Host workspace action on the New page

- [ ] 3.1 `fleet-row-actions.tsx`: the Host action navigates to `/new?machine=<host>` through upstream's `newPath`, gates unchanged; drop `host-workspace-form-port` and `fleet-host-space-sheet.test.tsx`
- [ ] 3.2 Rewrite `fleet-host-actions.test.tsx` cases for the navigation (peer, lead, refusals, no write on open)

## 4. Overlaps and routes

- [ ] 4.1 Keys dock editor adopted, mic beside Send kept; composer suites pass
- [ ] 4.2 Confirm `crew-focus-audit-name-port` still needed against 1.19's forward table
- [ ] 4.3 Gateway: focused cases that the new launch/launcher/worktree routes forward with the bearer and that `forget-device` is not reachable from a browser; document the shared-device semantics and one-off run default in `fleet/README.md`

## 5. Review every entry and record the boundary

- [ ] 5.1 Set `[upstream]` to `v1.19.0`; review every invasive entry with its verify list; record the decisions table in the design
- [ ] 5.2 Advance `reviewed = "v1.19.0"`; add the `UPSTREAM.md` row; record check-fork counts before and after
- [ ] 5.3 Both typechecks, lint, `test:fork`, `check-private-facts`, focused suites; commit with explicit pathspecs and Unreleased lines

## 6. Verify

- [ ] 6.1 Push `main` unreleased (`SKIP_TESTS=1`); run the full suites against that commit on the designated member; classify every failure against the 3.14.0 baseline
- [ ] 6.2 Headless Chromium on a local Fleet build: `/new` from a Host row and the dashboard shell

## 7. Release and level

- [ ] 7.1 Read the remote's newest tag; cut `chore(release): 3.15.0`; annotated tag `v3.15.0`, pushed by name
- [ ] 7.2 Level the lead, then each member; verify the census, the Gateway path, the New page start on the lead and a member, pairing refusal; close the throwaway workspaces

## 8. Archive

- [ ] 8.1 Sync specs, validate, archive, commit and push
