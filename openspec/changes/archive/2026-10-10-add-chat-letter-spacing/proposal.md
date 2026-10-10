## Why

Chat already has its own text-size control, but readers cannot adjust letter spacing to make it more compact. Add that missing device preference on the Collie v1.19.0 baseline.

## What Changes

- Add Chat letter spacing below its existing Text size row in Display.
- Allow bounded tighter/wider spacing and a reset to native normal spacing, persisted in this browser.
- Reuse native Chat font sizing without changing mirror/composer fonts or default sizes.
- Non-goals: line-height changes, typography changes outside Chat or shared server settings.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-settings`: browser-local Chat letter-spacing preference and its Display control.

## Impact

Owned preference/provider/control and locale strings, with narrow Display and SessionStream ports. Existing native shell supplies the scoped style variable. Frontend-only PATCH.
