## Why

The 3.23.0 web build fails: with Collie v1.23.3 merged in, the app's main chunk is 2.12 MB, above Workbox's 2 MiB default for `maximumFileSizeToCacheInBytes`, and `vite-plugin-pwa`'s injectManifest stops the build instead of leaving the chunk out. The chunk was already 2.01 MB in 3.22.0, so it was only just under the limit.

## What Changes

- The Fleet build raises the precache limit to 4 MiB, so the main chunk is precached and the build completes.
- One `FORK.toml` invasive entry declares the line in `web/vite.config.ts`.

## Capabilities

### New Capabilities
- `fleet-precache-limit`: the web build precaches the app's main chunk up to 4 MiB.

### Modified Capabilities
None.

## Impact

Baseline Collie v1.23.3. Upstream-owned: `web/vite.config.ts` (one option in `injectManifest`). Fork-owned: `fleet/precache-limit.test.ts`. A build fix with no behaviour change, so this is a PATCH release.
