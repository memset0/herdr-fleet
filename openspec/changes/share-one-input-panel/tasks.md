## 1. One panel for every question

- [x] 1.1 Add the shared prompt panel: heading, optional detail, focused-and-selected initial value, `Enter` submits with the string, `Escape` and dismissal cancel, one reserved line for a hint or a refusal; verify tests cover each of those and that the panel's size does not change when the refusal appears
- [x] 1.2 Make the rename input a caller of it, keeping its non-blank rule for a Tab and its blank-clears rule for a Pane; verify its existing tests pass unchanged
- [x] 1.3 Make the close confirmation a caller of it, keeping "only `y` closes"; verify its existing tests pass unchanged

## 2. The default answer moves into the question

- [x] 2.1 Put `y/N` in the confirmation's heading and remove the marker beside the field; verify a test asserts it is in the heading and that nothing precedes the input

## 3. Gates

- [x] 3.1 Declare the new file in `FORK.toml`, add the changelog line, and run the owned suites, both typechecks, lint, the fork check and strict OpenSpec validation; verify all pass
