## 1. Helper and port

- [x] 1.1 Add `web/src/lib/fleet-codex-status-row.ts` with `withFleetCodexStatusSegments` (glued-gap split, glued-separator space returned) and `fleetReadsUnpaintedNotice` (true only for `plain`); verify by its unit tests in 2.2
- [x] 1.2 Port `web/src/lib/harness/codex/markers.ts`: the import, the normalising call over `foldTrailingPadding(line.segments)`, and the row's separator paint passed into `isRightNotice`, whose unpainted-segment refusal asks the helper first; verify `git diff` shows only those lines
- [x] 1.3 Remove the closed "no client attached" known-gap entry for `codex--v0156-draft-multiline.txt` from `web/src/lib/harness/invariants.test.ts`, leaving a one-line anchor comment; verify that repaint now runs as an ordinary passing test

## 2. Fixtures and tests

- [x] 2.1 Add synthetic fixtures `web/src/fixtures/fleet-panes/codex--headless-status-9-items.txt` (truncated, notice) and `codex--headless-status-5-items.txt` (untruncated, notice); verify they carry no private word (`bun scripts/check-private-facts.ts`)
- [x] 2.2 Add `web/src/lib/harness/codex/fleet-headless-status-row.test.ts`: helper cases (both repairs, no-op on upstream-shaped rows, null passthrough, input not mutated, only `plain` relaxes the notice); both fixtures `composerReady` true, status row re-surfaced with its notice, no `unread-dialog` block; a coloured row with an unpainted notice and a row with uncoloured fields still refused; real Codex dialog fixtures still lifted with the composer not ready; verify `cd web && bunx vitest run src/lib/harness` passes
- [x] 2.3 Mutation check: helper normaliser returning its input, and `fleetReadsUnpaintedNotice` returning false, each makes the new fixture tests fail; `fleetReadsUnpaintedNotice` returning true makes the coloured-row refusal fail; restore and confirm green
- [x] 2.4 Replay every upstream fixture under `web/src/fixtures/panes/` through `buildBlocks` and `composerReady` at HEAD and with the port, and confirm zero differences

## 3. Boundary and docs

- [x] 3.1 `FORK.toml`: narrow `claude-mode-line-compat` to its two exact fixtures, add `[[owned]]` `codex-status-row-compat` (helper, suite, two fixtures) and `[[invasive]]` `codex-headless-status-row-port` (markers.ts and invariants.test.ts anchors, verify list, temporary reason, `reviewed = "v1.14.2"`); verify `bun run test:fork`
- [x] 3.2 One `### Fixed` line under `## [Unreleased]` in `CHANGELOG.md`, bold lead, saying the port is temporary

## 4. Verification

- [x] 4.1 Root and web typecheck, `bun run lint`, `cd web && bunx vitest run src/lib/harness`, `bun run test:fork`, `bun scripts/check-fork.ts`, `bun scripts/check-private-facts.ts`, `openspec validate exempt-codex-headless-status-row --strict`
- [x] 4.2 Public-tree audit: the diff and commit messages carry no device, host, path, network, credential or parent tooling name

## 5. Archive

- [x] 5.1 Archive with spec sync into `openspec/specs/fleet-harness-compat/spec.md`, validate `--specs --strict`; no release is cut by this change
