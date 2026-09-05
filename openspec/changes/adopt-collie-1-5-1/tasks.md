## 1. Open the merge

- [ ] 1.1 Re-run `bun scripts/check-fork.ts --target v1.5.1 --allow-active-changes` on a clean tree
  and verify it still reports the same release identity, 15 disturbed entries, 3 untouched and no
  owned-path collision
- [ ] 1.2 Run `git merge v1.5.1` and verify the merge stops with exactly the eleven conflicting paths
  `git merge-tree` predicted, and that `git rev-parse MERGE_HEAD` is
  `ba39c05c6350a52bcb0a88f118cd0680ff85a1c5`

## 2. Resolve the contract conflicts

- [ ] 2.1 Keep `CLAUDE.md` as the relative symlink to `AGENTS.md`; verify `test -L CLAUDE.md` and
  that it resolves to `AGENTS.md`
- [ ] 2.2 Keep this product's `CHANGELOG.md` and add one `## [Unreleased]` line for the adoption;
  verify no Collie entry has entered the file
- [ ] 2.3 Resolve `package.json`, `web/package.json` and `herdr-plugin.toml` to upstream's content
  with this product's `3.1.1` and the fork's own ports intact; verify `bash scripts/check-version.sh`
  passes
- [ ] 2.4 Rewrite `COLLIE_CHANGELOG.md` as `v1.5.1`'s changelog verbatim, the seam marker, then the
  `v1.2.0` entries upstream dropped, word-for-word; verify the retention check inside
  `bun scripts/check-fork.ts` passes

## 3. Resolve the code conflicts

- [ ] 3.1 `web/src/components/agent-chat.tsx` and `agent-chat.test.tsx`: take upstream's file and
  re-apply the manual Pane fit port; verify `cd web && bun run test agent-chat` and
  `bun test fleet/ui` pass
- [ ] 3.2 `web/src/components/app-header.test.tsx`: take upstream's file and re-apply what the
  navigation-sidebars port asserts there; verify `cd web && bun run test app-header` passes
- [ ] 3.3 `web/src/sw.ts`: take upstream's service worker and re-apply the authenticated-navigation
  boundary; verify `bun test fleet/sw-boundary.test.ts` and `cd web && bun run test sw-routes` pass
- [ ] 3.4 `web/src/test/handlers.ts`: take upstream's handlers and re-apply the Fleet settings route;
  verify `cd web && bun run test settings` and the playground app test pass

## 4. Review every entry

- [ ] 4.1 Review the fifteen disturbed entries one at a time against what the release now does,
  record a keep, adapt, replace or drop decision for each, and run that entry's declared `verify`
  list; verify each listed test passes
- [ ] 4.2 Review the three untouched entries — `native-pane-chrome-port`, `private-fact-guard-port`,
  `fork-gate-in-ci` — for a reason that upstream has made unnecessary; verify each is deliberately
  kept or dropped rather than carried forward unexamined
- [ ] 4.3 Drop any entry the release made unnecessary, returning its paths to upstream's versions,
  and remove it from `FORK.toml`; verify `bun scripts/check-fork.ts` reports no stale declaration
- [ ] 4.4 Advance `reviewed` to `v1.5.1` on every remaining entry; verify the boundary check no
  longer reports an entry lagging the adopted release

## 5. Record the provenance

- [ ] 5.1 Set `[upstream]` in `FORK.toml` to the `v1.5.1` tag, tag object and dereferenced commit;
  verify `bun scripts/check-fork.ts` classifies the tree against the new baseline with no
  unclassified path
- [ ] 5.2 Add the `3.1.1` → `1.5.1` row to `UPSTREAM.md`'s correspondence table and leave this
  product's version alone; verify the table reads as provenance and no version file moved

## 6. Gates

- [ ] 6.1 Run `bun run lint`, `bun run typecheck`, `cd web && bun run typecheck`,
  `bun run test:fork`, `bash scripts/check-version.sh` and `bun scripts/check-private-facts.ts`;
  verify all pass
- [ ] 6.2 Run the suites the adoption can reach — `bun test ./fleet`, `bun test ./cli`, the
  `scripts/` test files, and `cd web && bun run test` — and verify they pass; report any suite that
  cannot complete in this checkout, with whether it did so before the merge
- [ ] 6.3 Commit the merge with both parents, verify `git log -1 --format=%P` names HEAD's old commit
  and `ba39c05c6350a52bcb0a88f118cd0680ff85a1c5`, then push the branch by name with no tag switches
