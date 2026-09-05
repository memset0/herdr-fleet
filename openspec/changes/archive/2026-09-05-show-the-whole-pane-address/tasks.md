## 1. The address

- [x] 1.1 Build the row's context from the Tab, the Space and the host, in that order, omitting the parts a Pane does not carry; verify a row shows the whole address with no query typed
- [x] 1.2 Shift a match's positions out of its own field's coordinates and into the joined string's, so the marks land on the matched part; verify with one test per part asserting the marked characters are exactly the query
- [x] 1.3 Leave the address plain when the match was the Pane's own name; verify the marks are on the label instead

## 2. Verification

- [x] 2.1 Run both typechecks and the linter, and the full suites on nvl72 against the pushed commit
- [x] 2.2 Add the `CHANGELOG.md` line under `## [Unreleased]`
