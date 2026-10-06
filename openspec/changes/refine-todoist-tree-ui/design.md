## Context

See proposal.md for motivation. The owned Todoist component uses flattened tree rows, 12px indentation per level and a 44px checkbox column. Details already provide guarded Complete and Reopen buttons.

## Goals / Non-Goals

Keep existing task hierarchy, native Collapse and mutation flows. No new invasive files or backend changes.

## Decisions

- Increase indentation to 24px per level, retaining the existing eight-level cap and additionally limiting indentation to 40% of the available row width for narrow panels. This doubles visible hierarchy while preserving title space.
- Remove the checkbox column in Tree, List and Completed. Reuse existing detail actions instead of adding a second completion path.
- Keep this change active after publication and deployment until explicit owner acceptance; do not sync or archive yet.

## Risks / Trade-offs

Deep nesting consumes horizontal space → cap indentation proportionally and retain wrapping titles. Status changes take an extra click → intentional protection against accidental completion.

## Migration Plan

Lead-only PATCH deployment after focused verification. Roll back to the prior published commit if needed; no stored data migration.
