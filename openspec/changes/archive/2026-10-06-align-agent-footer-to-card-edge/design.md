## Context

See proposal.md. The body reserves 40px for its stacked controls; the footer unnecessarily copies this reserve.

## Goals / Non-Goals

Let footer content reach the card edge while retaining independent controls and readable wrapping.

## Decisions

Remove the footer's pr-10 override, leaving the standard 12px horizontal inset on both sides. Keep the body's reserve unchanged. Use a 4px top inset on the footer so its full-width content clears the stacked 28px controls; verify this with rendered bounds rather than altering button layout. All work stays in existing owned paths.

## Risks / Trade-offs

Footer content can reach below the controls → verify its first content line begins after their hit area and metadata stays on the final wrapping line.

## Migration Plan

Lead-only PATCH. No stored data or member changes.
