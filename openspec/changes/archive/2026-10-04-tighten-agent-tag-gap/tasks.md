## 1. Tag spacing

- [x] 1.1 Apply the reclaiming inset and synchronized margin transition in the owned tag component; pass focused tag/rail interaction tests.
- [x] 1.2 Check real browser fine/coarse tagged rows, wrapping and tag removal: reduced text gap, no action overlap and no collapse below the body floor.

## 2. Readiness

- [x] 2.1 Pass clean-baseline web typechecking, scoped lint/fork/privacy audits and strict OpenSpec validation; confirm the presentation-only artifacts match the final change.

## Verification evidence

A clean published baseline plus the owned component passed web typechecking, scoped lint, fork audit and 26 focused tag/rail tests. Chromium checked 56 state/theme/width/pointer cases: the first badge is approximately 7px below the detail line, labels stay clear of controls, and tag removal/insertion animations never shrink the shared surface below the body floor. Reduced-motion removal and independent activation also passed. No full suite was run.
