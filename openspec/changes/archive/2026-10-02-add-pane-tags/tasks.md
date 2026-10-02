## 1. Shared tag state

- [x] 1.1 Implement validated definitions, pane associations and attach/detach/edit commands; test name reuse, immutable identity, random default colors, duplicate rename refusal and bounds.
- [x] 1.2 Implement the atomic versioned store and authenticated Gateway route; test restart persistence, concurrent writes, invalid files, failed writes, origin and authentication gates.

## 2. Native editing and presentation

- [x] 2.1 Add shared browser state with refresh and conflict/error handling; verify with mocked HTTP responses and concurrent-refresh tests.
- [x] 2.2 Add named colored tag lines, assignment controls and global name/color editing in rail and settings; verify accessibility, identity guards, ordering, untagged density and unchanged navigation/favorites with focused UI tests.
- [x] 2.3 Translate all new controls in shipped locales, update the fork boundary, operator docs and Unreleased entry; verify dictionary, fork and privacy checks.

## 3. Acceptance

- [x] 3.1 Run both typechecks, lint, complete backend/frontend suites and build on the designated test runner; inspect desktop and phone rendering and resolve failures.
- [x] 3.2 Reconcile artifacts with implementation, run strict OpenSpec validation and public-tree review; leave complete evidence before archive and publication.
