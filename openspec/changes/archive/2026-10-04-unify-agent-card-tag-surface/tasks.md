## 1. Surface

- [x] 1.1 Put body and passive tag line in one surface with matching insets; pass focused rail/tag/navigation-shell tests including pin focus, editor isolation and untagged rows.
- [x] 1.2 Verify real browser tagged/untagged normal/current/blocked card/flat rows in light/dark themes and narrow/wide coarse/fine layouts: continuous paint, aligned padding, wrapping and independent activation.

## 2. Readiness

- [x] 2.1 Pass scoped lint, strict OpenSpec and owned diff checks; obtain clean published-baseline type/fork/privacy verification and confirm both deltas match the implementation without modifying concurrent work.

## Verification evidence

The clean published baseline plus the four owned files passed web typechecking, scoped lint, fork audit and 63 focused rail/tag/navigation tests. Chromium checked 56 combinations of row state, width, pointer and theme: body and tags share one painted surface, padding aligns, tags wrap, untagged rows reserve no extra line, hover paint is continuous, and tag/pin/editor activation stays independent from navigation. No full suite was run.
