## 1. Seen batch

- [x] 1.1 Add fork-owned `web/src/lib/fleet-mark-seen.ts`: `markPanesSeen(panes, scopeOf, read?)` issuing one seen read (`fetchPane(paneId, 1, scope)`) per pane, at most four in flight, failures tolerated
- [x] 1.2 Unit suite `web/src/lib/fleet-mark-seen.test.ts`: every pane read once with its own scope and the seen header, concurrency bounded, a failing read does not stop the rest

## 2. Rail control

- [x] 2.1 `native-agent-rail.tsx`: optional `onMarkAllSeen` prop; the control beside the summary line when a roster pane is unseen, with the unseen square and count, an accessible name with the count, disabled while in flight, hidden when none
- [x] 2.2 `native-navigation-shell.tsx`: a stable callback that runs the batch with `paneScope(data.scope, agent, data.servers, data.sessions)` and awaits `revalidate()`; passed into the memoised rail element (so the switcher sheet carries it)
- [x] 2.3 Keys `fleet.navigation.markAllSeen` and `fleet.navigation.markAllSeenLabel.one/.other` in all seven dictionaries

## 3. Gateway

- [x] 3.1 `fleet/proxy.ts`: add `x-collie-seen` to the upstream request-header allowlist; `fleet/proxy.test.ts` asserts it is forwarded and an unlisted header is still dropped

## 4. Tests

- [x] 4.1 `native-agent-rail.test.tsx`: control shown with count across hosts; tap calls back with exactly the unseen panes, disabled while in flight, keyboard activation; hidden when none or with no callback; a pane going unseen again shows it with the new count; summary line keeps its place
- [x] 4.2 `native-navigation-shell.test.tsx`: a tap sends one seen read per unseen pane on its own host (MSW), then revalidates; the switcher presentation carries the same control
- [x] 4.3 Mutation check: drop the seen header / the scope / the busy guard and confirm the relevant tests fail; restore

## 5. Boundary, docs, visual check

- [x] 5.1 `FORK.toml`: the helper and its test join the owned entry that holds the rail; confirm no new invasive path
- [x] 5.2 CHANGELOG Unreleased: one `### Added` line for the control and one `### Fixed` line for the Gateway seen header
- [x] 5.3 CDP visual check against the MSW mock build, dark theme, at 1600 and 390 widths (rail and switcher sheet); screenshots kept in the scratchpad, not committed

## 6. Verification

- [x] 6.1 Root and web typecheck, `bun run lint`, `cd web && bunx vitest run`, `bun test fleet/proxy.test.ts`, `bun run test:fork`, `bun scripts/check-fork.ts`, `bun scripts/check-private-facts.ts`, `openspec validate mark-all-seen-from-the-rail --strict`
- [x] 6.2 Public-tree audit: the diff and commit message carry no device, host, path, network, credential or parent tooling name

## 7. Archive

- [ ] 7.1 Archive with spec sync, validate `--specs --strict`; no release is cut
