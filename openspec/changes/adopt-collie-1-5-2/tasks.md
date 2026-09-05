## 1. Open the merge

- [ ] 1.1 Re-run the preflight on a clean tree and verify it reports the same identity, 8 disturbed
  entries, 11 untouched and no owned-path collision
- [ ] 1.2 Run `git merge v1.5.2` and verify every conflicting path falls inside a declared entry, and
  that the recorded merge parent is `cea2035e1f02d560d1bac66c85314828a7e01c20`

## 2. Resolve

- [ ] 2.1 `CLAUDE.md` stays the relative symlink to `AGENTS.md`; verify `test -L CLAUDE.md`
- [ ] 2.2 `package.json`, `web/package.json`, `herdr-plugin.toml`: upstream's content with this
  product's version and ports intact; verify `bash scripts/check-version.sh` passes
- [ ] 2.3 `COLLIE_CHANGELOG.md` becomes `v1.5.2`'s changelog, with the seam marker only if upstream
  dropped an entry; verify the retention check inside `bun scripts/check-fork.ts` passes
- [ ] 2.4 `agent-chat.tsx`, `history.tsx`, `app-header.test.tsx`: take upstream's file and re-apply
  each port, keeping the width refusals adapted to the ladder; verify the web suite passes

## 3. Review every entry

- [ ] 3.1 Review the 8 disturbed entries, decide each, and run its declared `verify` list
- [ ] 3.2 Review the 11 untouched entries for a reason upstream has made unnecessary
- [ ] 3.3 Rewrite the two width entries' `reason` to argue against the ladder rather than the retired
  768px cap; verify the boundary check reports no stale anchor
- [ ] 3.4 Advance `reviewed` to `v1.5.2` on every entry; verify the boundary check passes

## 4. Provenance

- [ ] 4.1 Set `[upstream]` in `FORK.toml` to the `v1.5.2` tag, tag object and commit; verify no
  unclassified path
- [ ] 4.2 Add the correspondence row to `UPSTREAM.md`

## 5. Gates

- [ ] 5.1 Run lint, both typechecks, `bun run test:fork`, `check-version.sh` and the private-fact
  guard; verify all pass
- [ ] 5.2 Run the suites the adoption can reach and verify they pass; report any that cannot complete
- [ ] 5.3 Verify whether `b88ebb4` fixes the `collie-cli.test.sh` failure inherited from `v1.5.1`

## 6. Release and rollout

- [ ] 6.1 Read the newest tag on the remote, cut the release at the next MINOR in one
  `chore(release)` commit, and verify `check-version.sh` passes
- [ ] 6.2 Commit the merge, push the branch and the tag by name, and verify the merge's second parent
- [ ] 6.3 Establish the member set from the lead's reachability entries reconciled against the
  per-device controllers, and record each member's currently deployed commit
- [ ] 6.4 Deploy the lead, then each peer, to the release commit; verify each controller's readiness
  gate passes and roll a failed member back alone
- [ ] 6.5 Verify every member's `status` reports the release commit, and report the rollout
