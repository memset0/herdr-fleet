## Context

See proposal.md. The current selector takes 60px and the build row reserves another 56px plus its rule. The owning navigation requirement currently mandates that older tab-bar alignment; this change deliberately replaces it.

## Goals / Non-Goals

Make the footer read as one compact group, without changing selection persistence or build identity. Preserve 44px touch targets, safe-area clearance, text zoom, theme contrast and reduced motion.

## Decisions

Use the existing Button primitive for transparent 44px targets over a single recessed track. A pointer-inert selected indicator occupies half the track and moves with a transform over 200ms; labels stay above it. Keep primary/primary-foreground tokens for the selected pair, giving the requested pale indicator in dark mode and a contrasting counterpart in light mode. Prefer this single moving element to cross-fading two independent button fills.

Use a 44px selector band and a 24px minimum caption row with 10px neutral-gray type, centered with wrapping allowed for qualified builds. Preserve bottom safe-area padding. Remove the caption's region divider and retired tab-bar alignment.

All implementation paths are already fork-owned in FORK.toml; no upstream invasive port changes. Existing tests are adjusted for the new visual contract rather than creating a new primitive or duplicate coverage. Verify real browser geometry and motion when browser tooling is available.

## Risks / Trade-offs

- Smaller caption → retain readable contrast and allow wrapping instead of clipping the build identity.
- Animation discomfort → motion-reduce disables the transform transition.
- Theme variation → use existing selected color tokens and inspect both themes.

## Migration Plan

No data migration. Build the frontend through the product build gate. Reverting the two component changes restores the previous presentation. Archive after verification; this browser-only change warrants a patch release under the product agreement.
