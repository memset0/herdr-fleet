## Why

Readers want Chinese fonts managed as independent UI/terminal fallback choices, with an optional CJK-only mode and no font options injected into native settings. Refine the Collie v1.19.0 downstream font stage and place Fleet settings below native section rows.

## What Changes

- Put UI and terminal CJK selectors plus individual “Use only CJK font” switches in one flat Fleet card; no selection means no custom fallback.
- Keep native primary fonts first in fallback mode; exclusive mode bypasses those fonts for its selected role. Terminal choices remain monospace.
- Use English-only font names; move fetched faces out of native primary-font pickers and restore their upstream files where possible.
- Preserve explicit browser choices through migration and separate UI/terminal storage and loading.
- Move the flat Fleet settings group below native grouped navigation without adding a submenu.
- Non-goals: backend/device configuration, peer rollout, new provider origins, Chat density changes or removing Chat's UI-prose behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-webfonts`: role-specific fallbacks, exclusive mode, browser migration and reduced native picker ports.
- `fleet-settings`: Fleet group follows native section rows on the Settings index.

## Impact

Owned catalog, controls and font application; existing CSS/mirror hooks and settings mount ports. Frontend PATCH, no operator or peer migration. Native font pickers revert to their baseline.
