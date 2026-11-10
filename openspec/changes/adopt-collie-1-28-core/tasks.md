## 1. Release-line reconciliation

- [x] 1.1 Obtain explicit approval for the parallel-release-line policy change; record the decision without treating general migration approval as a preflight bypass.
- [x] 1.2 Audit every commit in v1.23.1..v1.23.3 against v1.28.0; deliver a public-safe table of patch-equivalent, superseded and retained changes with evidence for each disposition.
- [x] 1.3 Add an exact-tuple release-line acknowledgement to the owned preflight; verify normal, approved, stale, unrelated-history and missing-ancestry cases with focused tests, then align the canonical synchronization rule and root working agreement with the verified policy before using it.
- [x] 1.4 Checkpoint only reviewed planning and prerequisite changes on main; verify a clean tree, exact baseline/target identities and authorized active-change inventory in the actual preflight report, including owned-path collisions.

## 2. Exact upstream adoption

- [ ] 2.1 Merge exact v1.28.0 as real second-parent ancestry; review every conflict against the upstream-line audit and preserve current downstream behavior, as verified by the complete conflict inventory and merge-parent check.
- [x] 2.2 Review every invasive entry with keep/adapt/replace/drop evidence and its declared verification; update FORK.toml and truthful provenance, retaining the upstream changelog's verbatim prefix and historical seam, then pass the fork boundary check.
- [x] 2.3 Reconcile send patience with upstream late-probe, partial-screen and post-record-token fixes; verify delayed success, immediate fast-path success, stale/draft refusal, residue cleanup and no deferred send holds with focused tests.
- [x] 2.4 Recompute complete send, forwarding and browser deadlines; test the longest enabled recovery path, slow writes, bounded polling gaps and uncertain outcomes without automatic resend.

## 3. Core-backed execution

- [x] 3.1 Add explicit validated Core backend/session/socket selection and standalone lifecycle; verify lead/peer child environments select the same endpoint and work without a TUI binary, registry or server while preserving trust boundaries.
- [x] 3.2 Resolve local Core panes and stable associations using permanent Core id, session and terminal id; test same-address collisions, alias changes, replacement cores, finished/missing/remote terminals and recoverable old TUI associations.
- [x] 3.3 Adapt terminal attachment and peer service to the selected backend through owned modules; verify argument/environment boundaries, local-only resolution, origin/authentication and browser exclusivity with focused tests.
- [x] 3.4 Implement explicit Core manual fit preserving current rows and existing attachment policy; verify bounded columns, release/reuse behavior and no automatic resize, including isolated native Core checks.
- [x] 3.5 Document the standalone Core migration and the major-change simplification review; inventory superseded TUI assumptions and send ports removed or retained, and verify public examples contain documentation-only values.

- [x] 3.6 Remove Todoist backend, routes, UI, translations, assets and dedicated tests; verify no executable Todoist reference remains, shared bindings/tags still pass, and live data/external tasks were not modified.

## 4. Acceptance and delivery

- [x] 4.1 Pass both typechecks, full-tree lint, root/web/Fleet suites, version consistency, all invasive-entry checks and public-tree/privacy audits; record exact commands and results.
- [x] 4.2 Exercise an isolated native Core end to end for screen reads, patient sends, raw terminal attachment, manual fit, browser exclusivity and Fleet restart without killing terminals; retain generic evidence only.
- [ ] 4.3 Prepare the selected deployment's snapshot, exact candidate and rollback outside the public source tree; obtain any separately required service/interruption approval, then verify authenticated Core Web access and unchanged terminal processes after switching only Fleet.
- [ ] 4.4 Publish the explicitly owner-authorized major release 4.0.0; verify all version files, changelog and the annotated product tag agree before publishing the adoption, without publishing upstream tags or creating a GitHub Release.
- [ ] 4.5 After complete acceptance and publication, validate/sync/archive only this change; report product, source push and actual deployment states separately, leaving unrelated active changes untouched.
