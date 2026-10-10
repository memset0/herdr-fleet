## Context

See proposal.md. The spacing provider already persists one numeric preference. Native Chat uses its own size floor and the stream's data-block wrappers reserve 12px paint containment via p-3/-m-3.

## Goals / Non-Goals

Add independent controls without changing native defaults, click behavior, virtualized painting or fonts. UI fonts are the subsequent stage.

## Decisions

- Keep the existing spacing key, extend its minimum, and add a separate bounded density record with nullable fields. Null means no CSS override.
- Put bounds and Fleet-only font minimum in an owned model. The native hook delegates only its exported Chat minimum; bare builds keep 12px.
- Promote the reused numeric settings row as an owned UI primitive before using it for all controls.
- Use scoped owned-shell styles for line height and gap. Account for collapsed adjacent margins with gap minus 24px, keeping the first top and last bottom margin at the native -12px; do not alter its p-3 containment wrapper.
- Mark existing vertically padded areas of native chat cards with an inert data attribute. Only the owned shell supplies the override; native defaults and minimum interactive heights remain.
- Extend the existing preference-hook attribution and declare the chat-card marker port. No backend work.

## Risks / Trade-offs

Small type/dense blocks can reduce readability → bounded choices with per-row reset. Tool/card rows have different native padding → leave overrides absent until explicitly chosen. Storage failure → retain in-memory values; accept cross-tab storage changes without throwing.

## Migration Plan

Frontend-only PATCH; archive and deploy this stage before implementing fonts. No peer rollout or server preference changes.
