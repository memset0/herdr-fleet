## Context

See proposal.md. The fork-owned card adds the marker after the combined heading and reserves its width even for seen rows.

## Goals / Non-Goals

Remove that extra visual mark while retaining native status and section-level unseen information. Receipt logic, upstream components and other row behavior are outside this change.

## Decisions

Delete the card's visible marker call and component import, retaining native unseen wording as screen-reader-only text on the primary button. Update the rail comment and existing Ready-row test to expect no unseen image while keeping the native dot, grouping and summary checks. The reclaimed heading width follows naturally. No new component, dependency or invasive path is needed.

## Risks / Trade-offs

Per-row redundancy is reduced; the Ready unseen group and summary count continue to convey unread state. Focused tests verify those signals and pin/navigation behavior.

## Migration Plan

Frontend-only patch; publish and deploy the lead after focused checks. No peer or stored-data migration. Restore the marker call to revert.
