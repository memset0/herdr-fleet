## Context

See proposal.md for motivation. The owned Todoist component uses flattened tree rows. The first iteration removed the checkbox column and increased indentation to 24px; the owner requested connector guides instead. Details already provide guarded Complete and Reopen buttons.

## Goals / Non-Goals

Keep task hierarchy, native detail Collapse and mutation flows. No new invasive files or backend changes.

## Decisions

- Replace enlarged left padding with a compact 12px-per-level guide gutter. Vertical continuation and elbow connectors follow visible sibling boundaries. Reserve one extra gutter column for the current parent stem; all decorative lines stay outside the clipped task card and span row gaps and expanded details. Cap nesting at eight levels and the gutter at 35% of row width.
- Move project/section/ancestor metadata into expanded details, including bound tasks. Keep project group headings and accessible task names for disambiguation.
- Move Bind/Unbind into the existing expanded action group for task results and bound tasks, preserving all existing identity and write guards.
- Tree descendants are always included and old collapsed-branch preferences are ignored. Remove branch arrows and empty control slots; retain only the guide gutter before the task title. The task title still toggles its own details.
- Use 28px desktop header controls with 2px insets, retaining 44px controls for coarse pointers. Keep detail actions at 44px. Header centers and connector elbows share a CSS variable.
- Remove the checkbox column in Tree, List and Completed. Reuse existing detail actions instead of adding a second completion path.
- Keep this change active after publication and deployment until explicit owner acceptance; do not sync or archive yet.

## Risks / Trade-offs

Deep nesting consumes horizontal space → cap the guide gutter proportionally and retain wrapping titles. Status changes take an extra click → intentional protection against accidental completion.

## Migration Plan

Lead-only PATCH deployment after focused verification. Roll back to the prior published commit if needed; no stored data migration.
