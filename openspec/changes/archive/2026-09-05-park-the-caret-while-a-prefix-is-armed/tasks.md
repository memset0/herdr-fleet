## 1. Parking

- [x] 1.1 Add a park/unpark pair to the focus module: park remembers the caret and moves focus to a non-editable element it owns, unpark returns it through the existing restore path; verify with DOM tests for park, unpark-to-offset, and unpark when the composer has gone
- [x] 1.2 Refuse to park while a composition is in flight, and verify the caret is untouched in that case
- [x] 1.3 Make the remembered caret readable, so the dispatcher and the panel can both prefer it over a live read

## 2. Wiring

- [x] 2.1 Park when the recognizer arms a prefix, and unpark on every outcome that is not another arm; verify a command, an Escape and an unregistered chord each restore the caret
- [x] 2.2 Give parking its own timer at the prefix timeout, so an abandoned sequence restores without another key; verify with fake timers
- [x] 2.3 Prefer the arm-time caret in the dispatcher, keeping the pane-switch rule deciding the mode; verify a prefix command restores to its offset and a prefix command that switches pane still lands at the end
- [x] 2.4 Exclude the parked element from the panel's restore target, falling through to the composer; verify a rename opened by a prefix command restores to the composer on close

## 3. Verification

- [x] 3.1 Run both typechecks, the linter, the fork check and the affected suites
- [x] 3.2 Run the full suites on nvl72 against the pushed commit
- [x] 3.3 Add the `CHANGELOG.md` line and assess the release axis
