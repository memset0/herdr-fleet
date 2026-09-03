## 1. One fold, one place for the state

- [x] 1.1 Remove the manual fold control from the tab row, leaving the state badge at its trailing end.
- [x] 1.2 Add one trailing slot to Collie's folded strips bar, rendered beside its button so the bar's accessible name is unchanged, and pass the state as a word.
- [x] 1.3 Gate the composer's band on the strips existing rather than on their being open, and update the Pane tests that folded through the removed control.

## 2. The rail and the drawer

- [x] 2.1 Put the rail row's favourite control at its top trailing corner and its age at its bottom trailing one.
- [x] 2.2 Give the phone's hierarchy drawer the rail's ground and title.

## 3. Verify and publish

- [x] 3.1 Run the Pane, rail, tree and shell tests plus both typechecks, lint, the fork check and strict OpenSpec validation.
- [x] 3.2 Record the new invasive anchor in `FORK.toml`, add a `CHANGELOG.md` line, commit, push, archive, and redeploy.
