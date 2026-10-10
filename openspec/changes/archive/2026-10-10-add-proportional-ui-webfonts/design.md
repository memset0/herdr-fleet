## Context

See proposal.md. The catalog currently serves Maple Mono via one stylesheet and one fallback variable. Native Typeface state is browser-local with a pre-paint twin; Chat's owned shell can scope its font variable without editing the stream.

## Goals / Non-Goals

Add proportional UI faces and Chat prose alignment. Keep full font files out of the bundle, existing defaults, terminal font choices and other content surfaces unchanged.

## Decisions

- Extend the owned closed catalog with explicit monospace-fallback eligibility and UI keys. Use existing ZeoSeven unicode-range stylesheets: Source Han Sans uses provider family `Noto Sans CJK` (69), LXGW WenKai uses `LXGW WenKai` (292). Families and HTTPS URLs were inspected from provider CSS.
- Retain the fallback link/variable and add one independently managed UI stylesheet. Deduplicate when both roles name Maple. Replacing a single shared link would evict the terminal fallback; bundling full fonts would penalize every update.
- Extend the existing native UI preset/class/stylesheet ports and cap the picker width for long bilingual names. Runtime and pre-paint classes agree; reconcile Maple's existing class too when switching choices.
- Scope `font-content` elements to `font-family: var(--font-sans)` inside Fleet's existing Chat stream only. Explicit mono text still uses its own font. This owner-requested exception supersedes ADR 0033's prose/font separation for Fleet Chat only; record it in AGENTS.md and DESIGN.md without editing upstream ADRs.
- Existing gateway catalog-origin policy already covers the same provider. No extra network/security port.

## Risks / Trade-offs

Provider unavailable → existing fallback stacks render and preferences remain. LXGW WenKai's provided face has one normal weight → browser synthesis handles bold. Longer names → bounded native picker width. Old stored choices → remain valid; no default changes or migrations.

## Migration Plan

Frontend PATCH after the density stage's deployment/archive. Validate focused catalog, DOM loading, picker/pre-paint and actual Chat glyph/font behavior; push source and deploy the lead. No peer work. Revert via the previous published deployment if necessary.
