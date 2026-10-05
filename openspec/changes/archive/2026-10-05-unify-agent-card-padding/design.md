## Context

See proposal.md. The fork-owned cards currently combine a 64px desktop body with 96px wide-touch bodies and 104px compact trailing reserves. Those branches arose from enlarged touch buttons and a horizontal workaround.

## Goals / Non-Goals

Goals: reproduce the desktop rail's compact vertical actions and insets across devices. Non-goals: changing shared upstream cards, tag editor controls or association behavior.

## Decisions

- Remove responsive action/body/tag sizing branches from the two owned components. Use the existing 28px action buttons, 64px body floor, 12px leading/8px vertical body padding, 40px trailing reserve and 8px tag inset recovery everywhere. Horizontal phone actions and 44px enlarged controls are rejected because the operator explicitly wants the desktop treatment.
- Keep metadata shrinking and combined-heading ellipsis so narrow content stays clear of the column. Shared Button and Collapse primitives remain unchanged. No invasive paths are added or edited.
- Archive after focused UI/browser checks; this frontend-only change warrants a patch release.

## Risks / Trade-offs

- Compact 28px controls have less thumb reach than 44px controls → keep independent nonoverlapping targets and existing focus semantics, matching the requested desktop presentation.
- Long text and tags could intrude on controls → verify narrow cards with long metadata/tags in both pointer modes.

## Migration Plan

No data migration. Publish the next patch and deploy the lead bundle; rollback by deploying the prior release if needed.

## Verification

Both typechecks, scoped lint, 26 focused rail/tag tests and fork/public-tree checks passed. Chromium checked 320 viewport/pointer/theme/text-size/state combinations with long metadata and tags: consistent vertical controls and insets, no overlap or overflow. No full suite was run. Existing presentation assertions were updated to reflect the revised compact pointer-independent contract.
