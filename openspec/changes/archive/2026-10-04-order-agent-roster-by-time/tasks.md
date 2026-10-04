## 1. Roster ordering

- [x] 1.1 Add stable time ordering to Recent/Ready/Working while preserving Needs/Pinned, deduplication and group order; verify focused roster tests including missing and zero timestamps, ties and navigation.
- [x] 1.2 Map last-active timestamps through the web adapter; verify adapter tests exercise opposite activity/seen ordering and native Pinned order.

## 2. Verification

- [x] 2.1 Audit the exact owned diff for public-safe content and fork ownership, run fork/privacy checks and OpenSpec validation, and report patch-axis release assessment; full product gates remain required before archive.

## Integrated verification

The complete root and web suites, both typechecks, full-tree lint, fork/privacy checks and product build passed together with the Agent rail presentation change. The overlapping native Agent behavior requirement carries the agreed compact presentation and timestamp ordering together.
