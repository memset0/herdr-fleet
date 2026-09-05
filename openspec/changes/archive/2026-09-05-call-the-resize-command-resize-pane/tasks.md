## 1. The rename

- [x] 1.1 Change the catalog's English name for `fit-pane-width` to `Resize Pane`; verify the root fleet suite passes
- [x] 1.2 Update the three acknowledgement assertions that name the old string; verify the dispatcher suite passes
- [x] 1.3 Add a command-bar test that searching `resize` lists the command; verify it fails against the old name and passes against the new one

## 2. Verification

- [x] 2.1 Run both typechecks and the linter, and the full suites on nvl72 against the pushed commit; record the results
- [x] 2.2 Add the `CHANGELOG.md` line under `## [Unreleased]` and assess the change against the release axis
