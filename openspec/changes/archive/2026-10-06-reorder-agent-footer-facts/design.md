## Context

See proposal.md. The existing footer is a wrapping flex flow, with tags before host metadata and a trailing auto margin on the host.

## Goals / Non-Goals

Reorder existing facts while keeping timestamp selection, avatar and independent action hit areas unchanged.

## Decisions

Pass the existing selected timestamp to the owned footer. Place native host/session metadata first, then the tag badges, then the formatted timestamp with an auto leading margin. Remove time from line two; keep its reserved height. An absent timestamp renders no invented time. Use the existing formatting helper and full-width footer insets. No new upstream or fork boundary.

## Risks / Trade-offs

Many badges may force time onto a further line → keep it last in flow and right-aligned, and verify narrow cards with zero/few/many tags.

## Migration Plan

Lead-only PATCH after focused verification; no state migration or peer redeployment. Todoist remains active awaiting acceptance.
