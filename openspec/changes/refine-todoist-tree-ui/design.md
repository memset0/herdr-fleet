## Context

See proposal.md for motivation. The owned Todoist component uses flattened tree rows. The first iteration removed the checkbox column and increased indentation to 24px; the owner requested connector guides instead. Details already provide guarded Complete and Reopen buttons.

## Goals / Non-Goals

Keep existing task hierarchy, native Collapse and mutation flows. No new invasive files or backend changes.

## Decisions

- Replace enlarged left padding with a compact 12px-per-level guide gutter. Vertical continuation and elbow connectors follow visible sibling boundaries; decorative lines are aria-hidden and stretch through expanded details. Cap the gutter at eight levels and 35% of row width.
- Move project/section/ancestor metadata into expanded details, including bound tasks. Keep project group headings and accessible task names for disambiguation.
- Remove the checkbox column in Tree, List and Completed. Reuse existing detail actions instead of adding a second completion path.
- Keep this change active after publication and deployment until explicit owner acceptance; do not sync or archive yet.

## Risks / Trade-offs

Deep nesting consumes horizontal space → cap the guide gutter proportionally and retain wrapping titles. Status changes take an extra click → intentional protection against accidental completion.

## Migration Plan

Lead-only PATCH deployment after focused verification. Roll back to the prior published commit if needed; no stored data migration.
