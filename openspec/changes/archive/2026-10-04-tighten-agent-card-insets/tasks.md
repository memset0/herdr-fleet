## 1. Perimeter spacing

- [x] 1.1 Tighten row and aligned tag insets while preserving line spacing; pass focused rail/tag/navigation-shell tests including pin focus and editor isolation.
- [x] 1.2 Verify real browser narrow/wide long-label/tag rows, settled light/dark colors and 44px coarse targets without text/action overlap.

## 2. Completion

- [x] 2.1 Pass both typechecks, lint, fork/privacy audits, diff checks and strict OpenSpec validation; add one patch changelog entry matching the implemented perimeter adjustment.
- [x] 2.2 Use the owner-requested focused verification for this spacing-only patch; confirm planning artifacts match implementation and archive readiness. Deployment still runs the product build.

## Verification decision

The owner explicitly requested small-scale verification for this patch and stopped the full-suite run. The focused rail/tag/navigation suites passed 62 tests; both typechecks, lint, fork/privacy audits and strict validation passed. Chromium checked 32 combinations of width, theme, pointer and row/card treatment without overlap. The release relies on these focused gates; it does not claim a completed full-suite run.
