## 1. One panel, two surfaces

- [x] 1.1 Promote the command bar's outer shell into a fork-owned `FleetPanel` — the dim, the top-anchored card at a bounded width, the ground and the rule — and render the command bar inside it; verify the bar's existing tests still pass unchanged
- [x] 1.2 Declare the new file in `FORK.toml`; verify `bun scripts/check-fork.ts` reports no unclassified path

## 2. Renaming where the keyboard is

- [x] 2.1 Add the rename input on that shell: prefilled with the target's current label and selected, `Enter` submits, `Escape` and dismissal cancel; verify tests cover the prefill, the selection, submission and each cancel path
- [x] 2.2 Keep each target's meaning — a Tab refuses a blank label inside the input without sending, a Pane's blank clears its label through Collie's own rename; verify a test covers both
- [x] 2.3 Close the input and send nothing when the route or the target changes under it; verify a test drives a route change with the input open
- [x] 2.4 Point `rename-tab` and `rename-pane` at the input instead of Collie's action sheet, leaving `close-tab` and `close-pane` on the sheet; verify a test proves the keyboard no longer opens a sheet for a rename and still does for a close
- [x] 2.5 Refuse before opening on a read-only device; verify a test covers it

## 3. Creating a Tab that you land in

- [x] 3.1 Delegate `create-tab` to Collie's own create-and-jump flow and drop the direct API call; verify a test proves one create is sent and the route receives the fresh Pane rather than waiting for a poll

## 4. Documentation and gates

- [x] 4.1 Correct the public documentation: rename opens an input where the command bar opens, and say precisely why a Space has no rename or close and why there is no new-Pane command; verify the documentation contract test still passes
- [x] 4.2 Add the input's labels to all six typed dictionaries; verify the i18n test passes
- [x] 4.3 Add one `CHANGELOG.md` line under `## [Unreleased]` and change no version file; verify `bash scripts/check-version.sh` passes
- [x] 4.4 Run the owned suites, both typechecks, lint, the fork check and strict OpenSpec validation; verify all pass
- [x] 4.5 Run the root suite, both typechecks, lint, the fork check and every touched web suite, and the build. The FULL web suite was not run for this change: the owner stopped it in favour of trying the deployed build directly, and that is recorded here rather than claimed as a pass
- [x] 4.6 Re-read the planning artifacts against what was built and reconcile any drift before archive
