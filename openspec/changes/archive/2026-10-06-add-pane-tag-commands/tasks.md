## 1. Catalog and adapters

- [x] 1.1 Add two default-unbound tag commands and document them; verify catalog and settings binding tests.
- [x] 1.2 Register tag adapters with the current scoped pane; verify command-bar and shortcut editor opening, absent-pane refusal, fresh target selection and no writes on open.

## 2. Verification

- [x] 2.1 Run focused tag/command/shell tests, both typechecks, scoped lint and strict OpenSpec validation.
- [x] 2.2 Audit fork boundaries and public-tree privacy; verify read-only browser palette and shortcut behavior.

Verification: 40 focused catalog/settings/documentation tests and 75 targeted component cases passed (the tag subset reran after correcting a highlighted-text query). Both typechecks, scoped lint, fork/privacy checks and strict OpenSpec validation passed. Chromium verified both palette entrypoints, direct and prefix shortcuts, contained editor focus and zero write attempts. No full suite was run.
