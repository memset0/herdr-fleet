## Context

The heading is currently a nested flex run with a 45% Space cap and two independent truncate spans. See proposal.md. Its surrounding ordinal, dot, Agent mark and unseen mark already occupy independent slots.

## Goals / Non-Goals

Give the phrase one truncation boundary while retaining its existing inline visual hierarchy. Preserve row floors, insets, gaps and all interaction behavior; no multiline heading or separate name reservation.

## Decisions

- Use one shrinking `flex-1 min-w-0 truncate` text container, containing inline Space, separator and name spans. Native inline text layout then paints exactly one trailing ellipsis and gives Space its natural width.
- Retain each child's color and name weight, and its existing data-glide name marker. Keep the surrounding marks as separate fixed flex children.
- Remove the Space cap and both child truncation rules. Keeping nested flex would allow those children to negotiate widths and reproduce preferential Space truncation.
- Both edited components are fork-owned. No new primitive, invasive port or manifest change is needed.

## Risks / Trade-offs

- A long Space can consume the visible phrase before the work name → this is the requested whole-phrase behavior, verified with long Latin and Chinese names.
- Inline geometry can affect unseen marks or narrow rows → measure real browser bounds at narrow widths, coarse pointers and larger text.

## Migration Plan

Browser-only PATCH, no stored-data or peer migration. Focused tests and geometry checks suffice for this requested verification scope; do not run the full release suites. Reverting the frontend restores separate truncation.

## Verification

Focused rail/tag/navigation-shell tests pass (63 tests). Browser geometry covers 200/240/320px, fine/coarse pointers, three Latin/Chinese naming cases and title text at 100%/150%; each phrase has one ellipsis container and its fixed marks/actions remain independent. A separate synthetic 200px coarse-pointer test with the entire root rem scale at 150% leaves zero heading width in both the preceding published row and this row; that unchanged extreme is outside this adjustment. A clean published baseline with this task's two code files passes web typecheck, scoped lint and fork-boundary audit. No full release suite was run, as requested.
