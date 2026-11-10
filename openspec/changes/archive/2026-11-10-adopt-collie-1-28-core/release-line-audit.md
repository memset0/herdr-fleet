# Parallel release-line audit

Adopted: `5bb4233b07cbfed2239fcfd7fe013323b55ac49c` (v1.23.3). Target: `b178eb63f2255637f6326bb942a2505e2004c31f` (v1.28.0). Actual common ancestor: `8c4c0d4f969da9e226933504f4ae79219916196a` (v1.23.1). The owner explicitly approved reconciliation and publication as 4.0.0.

`git cherry` compares patches. Non-equivalent commits below were checked against their original upstream changes and the target tree; release/changelog edits do not override this product’s own history.

| Adopted-line commit | Disposition in target |
| --- | --- |
| `a9234f672` fix(web): an AskUserQuestion with no question mark lifts its card | Patch-equivalent in target; reuse upstream. |
| `bf90d38be` fix(surface): a pi pane under an extension's inset editor takes sends again (#544) | Original f4c257293 is an ancestor of target; later edits extend the inset-editor implementation. |
| `69a4581c8` ci: run CI and the Windows job on release-* branches too | Patch-equivalent in target; reuse upstream. |
| `53a303509` docs(hermes): the profile reads the classic CLI; the Ink TUI is not read yet (#549) | Original 163262023 and follow-up 659010488 are in target; retain newer upstream guidance. |
| `4d594ca4e` test: agy names the plain no-question-mark capture as a known claim | Patch-equivalent in target; reuse upstream. |
| `56f667568` fix(surface): the Heads up follow-ups read as notices | Original db78a165a is in target; later grammar work supersedes the backport context. |
| `ab85563d2` fix(web): the Learn more explanation shows on its notice card | Patch-equivalent in target; reuse upstream. |
| `1e79f2c39` fix(held): a typed row offers Dismiss as well | Patch-equivalent in target; reuse upstream. |
| `fc13f77ca` fix(surface): the survey's transcript question reads as a notice with letter keys | Patch-equivalent in target; reuse upstream. |
| `122c8ac2d` fix(surface): a send whose first line is a notice key is a notice answer, letters and digits alike | Original 9d27b46b2 is in target; retain evolved protocol and notice tests. |
| `60696b8c6` fix(pi): read the powerline editor under the reporter's footer, two real captures (#544) | Patch-equivalent in target; reuse upstream. |
| `83c2c994a` fix(surface): Grok's and opencode's running-turn patterns are anchored, so a draft that names them is not a running turn | Original 774bb38e8 is in target; retain newer running-turn patterns. |
| `0ff223d93` chore(release): 1.23.2 | Release metadata/history only; retain upstream history accumulatively in COLLIE_CHANGELOG.md, never overwrite product versions. |
| `5a4ad3572` ci(webkit): pin the runner to ubuntu-24.04 and key the browser cache on it | Patch-equivalent in target; reuse upstream. |
| `cb96a1fef` test(web): turn node's own web storage off in the Vitest workers | Patch-equivalent in target; reuse upstream. |
| `7049ab87e` chore(bun): pin Bun 1.4.4, the first release with the eMudhra revocation (#568) | Original fe76cc67a is in target; retain target’s runtime pin. |
| `5bb4233b0` chore(release): 1.23.3 | Release metadata/history only; retain upstream history accumulatively in COLLIE_CHANGELOG.md, never overwrite product versions. |
