## 1. Guard

- [ ] 1.1 Add the raw-shape guard and its notice to `fleet/pack-authority.ts`, call it from `validatePackAuthority` after the file-name notice and before the reader; verify with `bun test fleet/pack-authority.test.ts`
- [ ] 1.2 Make `openStoreForEnrolment` in `fleet/pack-enrollment.ts` run the guard before opening the store; verify with `bun test fleet/pack-enrollment.test.ts`

## 2. Tests

- [ ] 2.1 In `fleet/pack-authority.test.ts`, cover crew-shaped → start, pack-shaped → refused with the notice (no values, directory byte-identical, injected reader never called), and both keys → proceed; verify the file passes
- [ ] 2.2 In `fleet/pack-enrollment.test.ts`, cover a pack-shaped store refused by both enrolment commands with nothing minted, dialled or written; verify the file passes
- [ ] 2.3 Mutation check: remove the guard call and confirm the pack-shaped tests fail, then restore it and confirm they pass

## 3. Docs

- [ ] 3.1 Add one paragraph to the native Pack authority section of `docs/herdr-fleet.md` and one `### Fixed` line under `## [Unreleased]` in `CHANGELOG.md`

## 4. Verification

- [ ] 4.1 Root and web typecheck, `bun run lint`, `bun test ./fleet`, `bun run test:fork`, `bun scripts/check-fork.ts`, `bun scripts/check-private-facts.ts` and `openspec validate refuse-pack-shaped-trust-store --strict` all pass; `FORK.toml` needs no change
- [ ] 4.2 Full suites on the designated test member at the change's commit, per the repository rule for a release
- [ ] 4.3 Public-tree audit: the diff and commit messages carry no device, host, path, network or credential

## 5. Release

- [ ] 5.1 Cut PATCH 3.5.1 in one `chore(release): 3.5.1` commit, `scripts/check-version.sh` ✓, tag `v3.5.1` and push branch and tag by name

## 6. Archive

- [ ] 6.1 Archive with spec sync into `openspec/specs/fleet-pack-authority/spec.md` and validate `--specs --strict`
