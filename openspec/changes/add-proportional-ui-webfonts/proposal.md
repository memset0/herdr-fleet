## Why

Readers want proportional Chinese UI faces and Chat prose that follows their UI choice. Extend the Collie v1.19.0 baseline after the completed Chat-density stage.

## What Changes

- Add Source Han Sans and LXGW WenKai to the existing UI Typeface picker with browser-local persistence and pre-paint class agreement.
- Fetch the chosen UI face and the existing monospace CJK fallback independently, deduplicating shared faces and retaining chunked loading and safe fallback.
- Make Fleet Chat prose follow the chosen UI stack; retain monospace code, terminal and composer behavior.
- Keep defaults and terminal font/fallback choices unchanged. No backend/peer rollout or bundled full CJK fonts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-webfonts`: proportional UI choices, role-aware simultaneous loading and Chat prose/UI-font alignment.

## Impact

Owned font catalog/loading and scoped Chat typography; narrow existing native font-picker, preference, pre-paint and CSS ports. Frontend-only PATCH. Reuse native Typeface selection and existing browser storage.
