## Context

See proposal.md. The pre-alignment rail placed state and ordinal at the corners of a 32px native AgentIcon. Current rows instead spend three heading slots on those facts.

## Goals / Non-Goals

Restore the avatar anatomy and reserve three baseline lines. Keep current typography, compact insets, tag badges, age and stacked actions.

## Decisions

- Place a 32px relative cluster before the existing text column, centered alongside both lines. Native AgentIcon draws its own artwork; no extra background square.
- Restore the native 10px state dot at the lower-right and 9px ordinal at the lower-left. Preserve native glide parts and the current-surface ground for hollow status rings.
- The first two text lines share a 56px body with the avatar; host/session move from the second line into a separate footer. Footer tags participate in one wrapping flex flow, followed by a trailing metadata item with auto leading margin. Thus a full tag line can precede a final line holding more tags and right-aligned host metadata. Retain a 16px footer baseline even without tags; the footer stays passive and inside the shared card surface.
- Reuse the existing nine-row ordinal bound and accessible state/unseen wording. No standalone ordinal column remains when a row is unnumbered.
- Only the existing owned card, tag-line component and focused tests change; no new FORK.toml port or path.

## Risks / Trade-offs

A wider icon can reduce narrow-panel text width → retain the existing flex shrink/ellipsis rules and verify narrow desktop and touch geometry with tags. Corner badges can clip → keep the cluster visible and inside the row's existing insets.

## Migration Plan

Frontend-only PATCH on the lead after focused checks. No stored data migration or member redeployment. Archive this change independently; Todoist UI acceptance remains pending.
