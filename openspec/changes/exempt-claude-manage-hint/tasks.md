## 1. Helper and ports

- [x] 1.1 Add `web/src/lib/fleet-claude-mode-line.ts` with `withoutClaudeManageHint`, using `SEGMENT_SPLIT` from `harness/menu-hints.ts`
- [x] 1.2 Port `tailNamesAMenu` in `web/src/lib/harness/claude/chrome.ts` and `tailNamesAKey` in `web/src/lib/harness/claude/index.ts` to pass each row through the helper (one line each, plus the import)

## 2. Fixtures and tests

- [x] 2.1 Add synthetic fixtures `web/src/fixtures/fleet-panes/claude--manage-hint--w120.txt` (full hint) and `claude--manage-hint--w73.txt` (clipped `↓ to ma…`)
- [x] 2.2 Add `web/src/lib/harness/claude/fleet-manage-hint.test.ts`: helper cases (full, clipped, right-aligned notice, every mode text, no-op outside the mode line, short clips); both fixtures `composerReady` true, `modalOnScreen` false, no unread-dialog card; the two real arrow-hint dialogs and the `↓ to manage`-only footer variant still modal and not ready
- [x] 2.3 Mutation check: make the helper return its input unchanged and confirm the working-screen tests fail; revert each port alone and confirm they fail; widen the helper to strip any `↓ to <verb>` and confirm the outside-the-mode-line and `↓`-only dialog tests fail; restore and confirm they pass

## 3. Boundary and docs

- [x] 3.1 `FORK.toml`: a new `[[owned]]` entry for the helper, test and fixture directory, and a new `[[invasive]]` entry `claude-manage-hint-port` (two anchors, reason, verify list, `reviewed = "v1.14.2"`)
- [x] 3.2 One `### Fixed` line under `## [Unreleased]` in `CHANGELOG.md`, saying the port is temporary

## 4. Verification

- [x] 4.1 Root and web typecheck, `bun run lint`, `cd web && bunx vitest run src/lib/harness`, `bun run test:fork`, `bun scripts/check-fork.ts`, `bun scripts/check-private-facts.ts`, `openspec validate exempt-claude-manage-hint --strict`
- [x] 4.2 Public-tree audit: the diff and commit messages carry no device, host, path, network, credential or parent tooling name

## 5. Archive

- [ ] 5.1 Archive with spec sync into a new `openspec/specs/fleet-harness-compat/spec.md`, validate `--specs --strict`; no release is cut by this change
