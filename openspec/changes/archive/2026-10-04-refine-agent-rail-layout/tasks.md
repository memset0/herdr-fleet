## 1. Presentation

- [x] 1.1 Apply smaller row type, roomier spacing, fixed stacked actions and hidden cache metadata; verify existing rail and tag interaction tests, including focus after pinning.
- [x] 1.2 Verify browser geometry for narrow/wide rows, long labels/tags, themes and coarse pointers; confirm text never overlaps either action.

## 2. Completion

- [x] 2.1 Run both typechecks, lint, full release suites and product build; pass fork/privacy audits and strict OpenSpec validation.
- [x] 2.2 Record the patch changelog and verify that all three capability deltas match the implementation before archive.

## Verification evidence

Focused rail/tag/navigation suites (62 tests), roster suites, both typechecks, full-tree lint, fork/privacy audits, complete root/web suites, and the product build passed. Chromium checked 12 narrow/wide, light/dark and fine/coarse pointer layouts: text and badges stay clear of the stacked actions, and settled dark-theme text remains readable. No upstream implementation path was changed.
