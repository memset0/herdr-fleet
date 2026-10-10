## Why

Readers need denser Chat typography and control over the vertical space inside and between content blocks. Extend the browser-local Display controls on the Collie v1.19.0 baseline.

## What Changes

- Lower Fleet Chat text size to 10px and letter spacing to -0.12em, retaining defaults and upper limits.
- Add line height (1.1–2.0), block vertical padding (0–16px) and between-block gap (0–24px), each with reset to native defaults.
- Keep settings local to the browser and preserve terminal/composer typography, interactive hit targets and stream paint containment.
- Non-goals: UI-font changes or font catalog additions, which are a subsequent owner-requested stage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-settings`: bounded Chat density controls and a lower text-size floor.

## Impact

Owned settings/model/UI controls and scoped styles, with narrow native preference and padding markers. Frontend-only PATCH; no backend or peer migration.
