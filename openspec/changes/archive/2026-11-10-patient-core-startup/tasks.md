## 1. Patient startup

- [x] 1.1 Share bounded Core readiness, caller and lock-age policy across the owned lifecycle; verify legacy selection, prompt readiness, delayed readiness, finite failure and competing-launch budgets with focused coverage.
- [x] 1.2 Exercise a synthetic listener starting after the legacy deadline; verify it becomes ready under Core policy and child cleanup leaves no process or listener behind.

## 2. Acceptance

- [x] 2.1 Pass lint, both typechecks, Fleet suite and unchanged-boundary/privacy/version gates; record exact validation results.
- [x] 2.2 Publish the minor 4.1.0 release through the separate functional/release commits, confirm its annotated tag and leave 4.0.0 unchanged.
- [x] 2.3 Verify the selected Core deployment accepts delayed cold startup while preserving existing Core and terminal processes; retain operational evidence outside public source.
- [x] 2.4 Validate the completed artifacts and delta set for automatic synchronization/archive and independent source publication, leaving unrelated changes untouched.
