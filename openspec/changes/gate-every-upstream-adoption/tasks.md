## 1. Working checkout

- [ ] 1.1 Run `scripts/install-hooks.sh` and verify `git config core.hooksPath` reports
  `scripts/git-hooks`

## 2. Manifest schema

- [ ] 2.1 Add `reviewed` to `ForkInvasiveEntry` in `scripts/fork-manifest.ts`, require it in
  `exactKeys`, validate it with the same tag pattern as `upstream.tag`, and move the accepted
  `schema_version` to `2`; verify `bun test scripts/fork-manifest.test.ts` passes
- [ ] 2.2 Extend `scripts/fork-manifest.test.ts` for the new field: a manifest missing `reviewed`,
  one with a malformed tag, and one still declaring `schema_version = 1` are each rejected; verify
  the suite passes
- [ ] 2.3 Set `schema_version = 2` in `FORK.toml` and add `reviewed = "v1.2.0"` to all seventeen
  `[[invasive]]` entries in the same edit; verify `bun scripts/check-fork.ts` parses the manifest

## 3. Review gate and changelog retention

- [ ] 3.1 Fail the repository check in `scripts/check-fork.ts` for every invasive entry whose
  `reviewed` differs from `upstream.tag`, naming each entry; verify with a manifest fixture in
  `scripts/check-fork.test.ts`
- [ ] 3.2 Fail the repository check unless `git show <upstream.commit>:CHANGELOG.md` is a byte-exact
  prefix of `COLLIE_CHANGELOG.md`, and — when the retained file is longer — unless the first line
  after the prefix is the seam marker from design.md; verify with fixtures covering equal files, a
  correct seam, a missing marker, and edited retained text
- [ ] 3.3 Verify `bun run test:fork` passes against the real tree, where the two files are currently
  byte-equal

## 4. Preflight

- [ ] 4.1 Add `--target <ref>` and `--allow-active-changes` argument handling to
  `scripts/check-fork.ts`, leaving the no-argument repository check unchanged; verify the existing
  `bun run test:fork` still passes
- [ ] 4.2 Implement the preflight steps in design.md order — dirty tree, annotated tag and
  dereferenced commit, merge base equals the recorded baseline, active OpenSpec changes, disturbed
  and undisturbed invasive entries, owned paths the target ships — reporting and exiting without
  editing, fetching, or merging; verify each refusal and each report with cases in
  `scripts/check-fork.test.ts`
- [ ] 4.3 Verify the preflight against the real repository: `bun scripts/check-fork.ts --target
  v1.5.1 --allow-active-changes` reports 14 disturbed entries, 3 undisturbed, and no owned-path
  collision, and the same command without the flag refuses while a change is active

## 5. Specification and guidance

- [ ] 5.1 Rewrite the `release-history` contract in `FORK.toml` and the changelog paragraph in
  `UPSTREAM.md` and `CHANGELOG.md` from byte-identical retention to accumulative retention; verify
  no tracked file still claims Collie's changelog is retained byte-identically
- [ ] 5.2 In `AGENTS.md`, correct the branch named in the OpenSpec and Git workflow section, and
  replace the prohibition on merging an upstream release with a pointer to the adoption procedure;
  verify by reading the section back for a branch name that matches the repository
- [ ] 5.3 Add `bun run test:fork` to `ci.yml` with `fetch-depth: 0` on that job's checkout; verify
  the workflow file's job reads the full history before the check runs

## 6. Gates

- [ ] 6.1 Run `bun run lint`, `bun run typecheck`, `bun run test`, `bun run test:fork`, and
  `bash scripts/check-version.sh`; verify all pass
- [ ] 6.2 Audit the staged diff for private operator, device, domain, or parent-repository facts and
  for a `FORK.toml` that matches the tree it describes; verify
  `bun scripts/check-private-facts.ts` passes and the boundary check reports no unclassified path
