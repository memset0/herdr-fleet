## 1. Precache limit

- [x] 1.1 Set `maximumFileSizeToCacheInBytes` to 4 MiB in `web/vite.config.ts`'s `injectManifest`; add `fleet/precache-limit.test.ts`; verify `bun run build` in web/ completes and the main chunk is in the precache manifest.

## 2. Delivery

- [x] 2.1 Add `fleet-precache-limit-port` to `FORK.toml` and a CHANGELOG line; verify typecheck, lint, `bun run test:fork`, `bun run test:fleet` and `openspec validate fleet-precache-limit`.
