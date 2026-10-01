## 1. Helper

- [x] 1.1 Widen `withoutClaudeManageHint` in `web/src/lib/fleet-claude-mode-line.ts`: after the permission-mode text, drop any whole `esc to interrupt` and a trailing `↓ to manage` (either clipped with `…` as the last segment, no shorter than `<key> to`); no agent-count requirement; header comment updated

## 2. Fixtures and tests

- [x] 2.1 Add synthetic fixtures `web/src/fixtures/fleet-panes/claude--v2286-agents-interrupt-manage-hint--w120.txt` (full) and `claude--v2286-agents-interrupt-manage-hint--w93.txt` (clipped `↓ to ma…`)
- [x] 2.2 Update `web/src/lib/harness/claude/fleet-manage-hint.test.ts`: overturn "no agent count" and "count not a number"; helper cases for both hints, only the manage hint, only `esc to interrupt`, clipped `esc to…`, short clips, `Esc to cancel` kept; both new fixtures ready / no modal / no card; screens with only one hint; dialogs still detected
- [x] 2.3 Mutation check: helper returning its input fails the new working-screen tests; dropping the `esc to interrupt` rule fails the interrupt cases; widening to any `<key> to <verb>` fails the `Esc to cancel` and dialog cases; restore and pass

## 3. Boundary and docs

- [x] 3.1 `FORK.toml`: add the two fixtures to `claude-mode-line-compat` and widen its contract; widen `claude-manage-hint-port`'s intent and reason (no path change)
- [x] 3.2 One bold-lead `### Fixed` line under `## [Unreleased]` in `CHANGELOG.md`

## 4. Verification

- [x] 4.1 Root and web typecheck, `bun run lint`, `cd web && bunx vitest run`, `bun run test:fork`, `bun scripts/check-fork.ts`, `bun scripts/check-private-facts.ts`, `openspec validate widen-claude-mode-line-hint --strict`
- [x] 4.2 Public-tree audit: the diff and commit message carry no device, host, path, network, credential or parent tooling name

## 5. Archive

- [x] 5.1 Archive with spec sync into `openspec/specs/fleet-harness-compat/spec.md`, validate `--specs --strict`; no release is cut
