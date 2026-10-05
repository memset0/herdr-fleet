## 1. Responsive layout

- [x] 1.1 Apply the phone action row, body reserve/floor and tag geometry; pass focused rail/tag tests and retain pin/editor isolation.
- [x] 1.2 Verify real phone-width layouts with fine/coarse pointers, long headings/metadata/tags, both themes and enlarged text; confirm independent targets and no horizontal overflow.

## 2. Readiness

- [x] 2.1 Pass web typechecking, scoped lint, fork/privacy audits and strict change/spec validation; confirm all three deltas match the final implementation. No full suite.

## Verification evidence

Both typechecks, scoped lint, fork/privacy audits and 26 focused rail/tag tests passed. Chromium checked 320 row/state/theme/width/pointer/font-size cases (320–1600px, including phone landscape and 150% root text size): compact layouts keep a 64px default body with independent 44px targets, wide desktop controls stay stacked, and headings, metadata, timestamps and tag badges do not overflow or overlap actions. No full suite was run.
