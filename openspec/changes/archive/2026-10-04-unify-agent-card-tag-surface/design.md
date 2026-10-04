## Context

The row paints Card/div only around the navigation button's body. Its tag Collapse is a sibling outside that shell. The shared Card primitive already supports the surface needed here; see proposal.md.

## Goals / Non-Goals

Join body and tags into one surface without joining their activation semantics. Retain heading ellipsis, 12/11px type, 6px internal gap, 64/96px body floors and stacked actions. Do not modify tag identity, the editor or generic primitives.

## Decisions

- Keep the existing outer identity wrapper and move the Card/div shell around the body button and passive tag line. Clear Card's default vertical padding and gap. Paint background, border and hover/current/blocked state once on this shell instead of duplicating them on the tag line.
- Give the shell an explicit surface attribute while retaining the native Card slot, and give the body its own slot. Use the same column flow for card and flat surfaces to avoid an inline-button baseline gap. The wrapper retains row identity and contains sibling pin/tag actions, preserving focus lookup and avoiding nested controls. The shell has no navigation handler.
- Keep horizontal insets on body and tag line at 12px leading and 40px/56px trailing. Use 8px bottom padding on the tag line to match the body's vertical perimeter while its top inset stays compact. Untagged rows retain no extra line.
- Use shell padding only for the border; retain body minimum heights and the existing Collapse animation. No new primitive or invasive path is needed; all owned paths are already declared.

## Risks / Trade-offs

- Reparenting can invalidate fragile selectors → tests use explicit surface/body slots and preserve data-row-key/pin focus behavior.
- Hover painting must include passive tags → put hover paint on the shared shell and measure normal/current/blocked rows in both themes.
- A tagged card gains natural height → verify full labels wrap and both buttons remain within the body reserve.

## Migration Plan

Browser-only PATCH, no data/peer migration. Verify focused component behavior, real geometry and clean-baseline type/lint/boundary checks; no full suite per the requested scope. Reverting frontend source restores the preceding detached tag line.
