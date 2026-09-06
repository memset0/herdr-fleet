## 1. Naming the machine

- [x] 1.1 Carry the operator-facing host name on the roster entry, resolved through Collie's own `hostName` and set only where there is more than one machine; verify the lead's Panes carry the name the rails show and a solo install carries none
- [x] 1.2 Search the host by the displayed name rather than the internal id; verify searching the name finds the Panes and searching the id does not

## 2. The row

- [x] 2.1 Lay the row out as Space, Tab, Pane name, host tag, with the Space and the Pane name de-emphasised; verify with a test reading a row's parts in order
- [x] 2.2 Mark each field from its own match and leave the host tag unmarked; verify one test per markable field, and that the tag never carries marks
- [x] 2.3 Delete the joined-address offset arithmetic, which has nothing left to shift

## 3. Verification

- [x] 3.1 Run both typechecks, the linter and the affected suites
- [x] 3.2 Add the `CHANGELOG.md` line
