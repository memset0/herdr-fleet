## 1. The filter

- [x] 1.1 Omit from command mode the command that opens the surface being read, written as the rule rather than as an id; verify a test asserts the row is absent from the bar and that every other catalog command is still listed
- [x] 1.2 Verify the command is untouched elsewhere: still bindable, still fired by its bindings, still present in the settings reference

## 2. Verification

- [x] 2.1 Run both typechecks, the linter and the affected suites
- [x] 2.2 Add the `CHANGELOG.md` line under `## [Unreleased]`
