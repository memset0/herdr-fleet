## 1. One rename

- [x] 1.1 Mount the keyboard's rename component from the row-actions menu for both a Pane and a Tab, passing the target it already has; verify the menu's existing tests pass and a test proves one save runs
- [x] 1.2 Remove the duplicated save, its saving state and the old dialog import from the row-actions surface; verify the file no longer calls a rename endpoint itself

## 2. One prompt surface

- [x] 2.1 Delete the centred prompt dialog and its `FORK.toml` entry now that it has no caller; verify `bun scripts/check-fork.ts` passes and nothing imports it

## 3. Gates

- [x] 3.1 Add the changelog line and run the owned suites, both typechecks, lint, the fork check and strict OpenSpec validation; verify all pass
