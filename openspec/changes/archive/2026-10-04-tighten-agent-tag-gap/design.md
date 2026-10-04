## Context

At default type size, the body floors are 64px (fine pointer) and 96px (coarse pointer), while the two text lines occupy about 38px. Centering leaves an unused lower band before the tag line. See proposal.md.

## Goals / Non-Goals

Reduce the visible text-to-tag gap while retaining the approved body geometry, action targets and shared surface. Do not introduce tag identity logic or alter generic primitives.

## Decisions

Reclaim 8px on fine pointers and 24px on coarse pointers with a negative top margin on the tag Collapse while tags are present. Both modes then place the first badge approximately 7px below the detail line. The existing trailing text reserve keeps the raised tags clear of the action column.

Use the primitive's data-state to apply the inset only when expanded. Its existing transition-all already animates margin-top with grid height and opacity, using the same duration and reduced-motion policy. The inset is zero in the initial closed frame and returns to zero on exit, so an untagged row keeps its full body floor. A margin on the inner clipped content would hide badges, so the inset belongs on the Collapse wrapper.

The owned component is already declared by FORK.toml; there is no new invasive path. A new data hook or a body-layout redesign is unnecessary for this presentation adjustment.

## Risks / Trade-offs

- Raised tags could meet the action column → verify badge bounds stay within the existing trailing reserve.
- Collapsing tags could briefly shrink the row below its body floor → inspect removal animation and its final untagged geometry in both pointer modes.

## Migration Plan

Browser-only PATCH 3.7.7 to 3.7.8. Use focused tag interaction tests and real browser spacing/animation checks; no full suite. Deploy the lead after publication. Reverting the component restores the former gap.
