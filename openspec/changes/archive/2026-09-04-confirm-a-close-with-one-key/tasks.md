## 1. The confirmation

- [x] 1.1 Add a fork-owned confirm dialog on the panel shell: a line naming the target and its cost, an input holding `y`, selected, with a `y/N` prompt; verify tests cover the prefill and the prompt
- [x] 1.2 Close only on `y`, case-insensitively and trimmed; verify tests cover `y`, `Y`, `n`, an unrelated string and an empty field, and that only the first two send anything
- [x] 1.3 Send nothing on `Escape`, on dismissal, and on a target change; verify a test covers each

## 2. Both close commands use it

- [x] 2.1 Point `close-tab` and `close-pane` at the confirmation instead of the row-actions state, keeping the safe-Home reconciliation when the displayed Pane is the one closed; verify a test proves the keyboard no longer opens the row-actions surface for a close
- [x] 2.2 Confirm the catalog holds exactly these two close commands and no third that fires on its chord; verify a test asserts it over the catalog rather than by inspection

## 3. Gates

- [x] 3.1 Add the prompt's strings to all six dictionaries; verify the i18n test passes
- [x] 3.2 Run the owned suites, both typechecks, lint, the fork check and strict OpenSpec validation, and add the changelog line; verify all pass
