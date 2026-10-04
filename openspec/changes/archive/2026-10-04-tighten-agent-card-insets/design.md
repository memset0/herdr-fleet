## Context

The current row uses 16px leading inset, 12px vertical padding, 72px content floor and a 48px action reserve. Two 28px actions start 8px from the top and right; coarse pointers use 44px actions and a 104px floor. See proposal.md.

## Goals / Non-Goals

Reduce perimeter whitespace while preserving the existing 6px internal line gap, text sizes, ordering and control behavior. Section spacing and sidebar outside insets are outside this change.

## Decisions

- Reduce the leading inset to 12px and vertical padding to 8px; retain the 6px line gap. Shrinking the internal gap instead would undo the accepted readable content spacing.
- Move the action column to 4px from the top and trailing edge. Use a 40px desktop text reserve and 56px coarse reserve, leaving an 8px text-to-target gap. Keep action sizes at 28px/44px.
- Set minimum content heights to 64px desktop and 96px coarse: two targets plus 4px edge space above and below. Keep a minimum rather than a fixed height for enlarged text.
- Align tag lines at 12px and reduce bottom padding from 8px to 4px. Preserve wrapping, all names and the existing badge/editor presentation.
- All edited paths are fork-owned; no invasive port or FORK.toml change is needed.

## Risks / Trade-offs

- Tighter geometry can crowd targets or enlarged text → check narrow/wide browser rows and coarse pointers, retain text reserves and independent target bounds.
- Theme transitions can distort screenshots → capture only after transitions settle and inspect computed text colors.

## Migration Plan

Browser-only PATCH 3.7.4 to 3.7.5. No data or peer migration. Use focused component and browser verification at the owner's request, then run the product build during lead deployment. Do not run full product suites for this spacing-only patch. Reverting the frontend restores the preceding perimeter spacing.
