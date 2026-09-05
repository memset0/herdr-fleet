## 1. Open the merge

- [x] 1.1 Re-run the preflight on a clean tree and verify it reports the same identity, 8 disturbed
  entries, 11 untouched and no owned-path collision
- [x] 1.2 Run `git merge v1.5.2` and verify every conflicting path falls inside a declared entry, and
  that the recorded merge parent is `cea2035e1f02d560d1bac66c85314828a7e01c20`

## 2. Resolve

- [x] 2.1 `CLAUDE.md` stays the relative symlink to `AGENTS.md`; verify `test -L CLAUDE.md`
- [x] 2.2 `package.json`, `web/package.json`, `herdr-plugin.toml`: upstream's content with this
  product's version and ports intact; verify `bash scripts/check-version.sh` passes
- [x] 2.3 `COLLIE_CHANGELOG.md` becomes `v1.5.2`'s changelog, with the seam marker only if upstream
  dropped an entry; verify the retention check inside `bun scripts/check-fork.ts` passes. No seam
  again: `v1.5.2` drops no release heading `v1.5.1` had
- [x] 2.4 `agent-chat.tsx`, `history.tsx`, `app-header.test.tsx`: take upstream's file and re-apply
  each port, keeping the width refusals adapted to the ladder; verify the web suite passes

## 3. Review every entry

- [x] 3.1 Review the 8 disturbed entries, decide each, and run its declared `verify` list. Two
  needed real adaptation rather than re-application: `native-agent-favorites-port` gains the new
  `zh-TW.ts`, whose 79 missing downstream keys were written in upstream's own Traditional register;
  `private-fact-guard-port` gains upstream's new `pre-commit.test.sh`, whose throwaway repository
  carries no copy of this fork's guard script, so the guard joins the two that fixture already
  disarms
- [x] 3.2 Review the 11 untouched entries for a reason upstream has made unnecessary
- [x] 3.3 Rewrite the two width entries' `reason` to argue against the ladder rather than the retired
  768px cap; verify the boundary check reports no stale anchor
- [x] 3.4 Advance `reviewed` to `v1.5.2` on every entry; verify the boundary check passes

## 4. Provenance

- [x] 4.1 Set `[upstream]` in `FORK.toml` to the `v1.5.2` tag, tag object and commit; verify no
  unclassified path
- [x] 4.2 Add the correspondence row to `UPSTREAM.md`

## 5. Gates

- [x] 5.1 Run lint, both typechecks, `bun run test:fork`, `check-version.sh` and the private-fact
  guard; verify all pass
- [x] 5.2 Run the suites the adoption can reach and verify they pass; report any that cannot complete
- [ ] 5.3 Verify whether `b88ebb4` fixes the `collie-cli.test.sh` failure inherited from `v1.5.1`

## 6. Release and rollout

- [x] 6.1 Read the newest tag on the remote, cut the release at the next MINOR in one
  `chore(release)` commit, and verify `check-version.sh` passes
- [x] 6.2 Commit the merge, push the branch and the tag by name, and verify the merge's second parent
- [x] 6.3 Establish the member set from the lead's reachability entries reconciled against the
  per-device controllers, and record each member's currently deployed commit
- [x] 6.4 Deploy the lead, then each peer, to the release commit; verify each controller's readiness
  gate passes and roll a failed member back alone
- [x] 6.5 Verify every member's `status` reports the release commit, and report the rollout
