## Context

The 44px touch targets currently remain stacked. Their 88px combined height and edge insets require a 96px body, while fine-pointer rows use 64px. The 24px coarse tag inset compensates for that height. See proposal.md.

## Goals / Non-Goals

Compact the phone row while retaining usable controls and all current interactions. Keep desktop stacking, grouping, identity and generic primitives outside the change.

## Decisions

Use compact layout at phone widths (below 40rem) or for touch-operated switchers below the standing Agent-rail breakpoint (96rem), including phone landscape. Compact controls form a horizontal pair with 44px targets, a 4px gap and an 8px top inset. Reserve 104px on the body's trailing side so the pair never overlays text. The body uses the 64px floor on phones; standing wide coarse-pointer rails keep their existing 96px floor for stacked targets.

Phone tags use the normal 8px upward inset and 12px card-edge padding on both sides, because the action row ends above the tag line. Wide layouts retain their existing tag reserves/insets. This removes the compensating phone spacing dependency on vertical controls.

Test long host/session metadata and timestamps in the smaller text region; narrow native metadata shrinks only at this fork-owned caller, with its empty cache wrapper removed from phone flow, without changing upstream components or identity. Keep the single combined-heading ellipsis and existing passive tag behavior.

All edited paths are already fork-owned. No dependency, primitive or invasive path is added.

## Risks / Trade-offs

- A horizontal action pair takes more text width → reserve its real bounds and verify long metadata/headings at 320–430px.
- Touch and width breakpoints can interact → verify phone fine/coarse pointers and wide fine/coarse layouts separately, including tags and enlarged text.

## Migration Plan

Frontend-only PATCH 3.9.0 to 3.9.1. Focused component, type/lint/boundary and browser checks; no full suite. Publish and deploy the lead after verification; no peer or data migration.
