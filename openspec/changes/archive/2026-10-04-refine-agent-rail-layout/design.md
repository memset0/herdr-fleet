## Context

The current row fixes its content at 44px, inherits 16px title type, uses 12px detail type, and reserves 80px for two horizontal 36px actions. Cache readings consume additional width in the second line. See proposal.md.

## Goals / Non-Goals

Give text more usable width and breathing room while keeping the right action column stable. Preserve routing, triage, pin focus, tag editing and every assigned tag name. Leave upstream components and other surfaces unchanged.

## Decisions

- Use 12px titles and 11px detail text with a small inter-line gap, 16px left padding, a 72px content floor, and a 48px trailing reserve instead of 80px. Smaller text and a single action column recover width despite the slightly larger inset.
- Use existing Button primitives in one fixed right-side column: pin first, tag editor second. At the user's request these desktop controls shrink to 28px with 14px glyphs, departing from the previous 36px visual control. Coarse pointers retain 44px targets and a 104px content floor so the controls never overlap. Focus restoration targets the pin's explicit data slot after it changes group.
- Pass undefined cache to the existing PaneMeta from the rail only. Host/session behavior stays native; no shared metadata implementation changes.
- Add an optional compact TagBadge presentation for the rail (10px label, smaller dot); the tag editor retains its existing badge size. Tag lines keep all names and wrap within the text reserve.
- All edited components are already fork-owned in FORK.toml. No upstream file or manifest boundary changes are required.

## Risks / Trade-offs

- Two vertical controls require taller rows → gain text width, retain a minimum rather than fixed height, and verify narrow layouts and enlarged text.
- Moving the star changes its DOM location → update its focus lookup and exercise pin/unpin navigation isolation.
- Small desktop controls → keep separated targets and enlarge them for coarse pointers.

## Migration Plan

Browser-only PATCH; no stored-data migration or peer deployment. Validate focused component behavior, browser geometry and the product release gates, then publish and deploy the lead. Reverting the frontend restores the old layout.
