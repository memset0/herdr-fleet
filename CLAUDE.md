# Working agreement

Herdr Web Remote (`memset0.web-remote`) is a public-ready Herdr 0.8+ plugin derived from Collie.
Read `README.md`, `ARCHITECTURE.md`, `UPSTREAM.md`, and `HERDR_API.md` before changing boundaries.

## Non-negotiable boundaries

- Never commit credentials, private deployment names/paths, live terminal/session data, SSH keys,
  or parent-repository context. Examples and tests stay synthetic.
- Keep Gateway and Collie loopback-only. The Gateway remains the uniform authentication boundary;
  every Collie data/API/navigation route is protected, while only static PWA update assets may be
  public.
- Preserve Collie's Host/Origin, CSP, text-node rendering, filesystem containment, and prompt-binding
  security invariants.
- The supported lifecycle is the plugin-owned supervisor. Do not add systemd, launchd, cron,
  Tailscale, a public listener, or a shared-home pidfile.
- Keep Fleet aggregation to stable summary fields. Pane contents stay on the native node route.

## Versioning

`herdr-plugin.toml`, root `package.json`, `web/package.json`, and the newest `CHANGELOG.md` heading
must agree. Functional changes require a SemVer bump and a concise changelog entry citing the short
feature commit. Run `scripts/check-version.sh`. Tag releases as `vX.Y.Z` after the release commit.

## Verification

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
cd web && bun install --frozen-lockfile && bun run typecheck && bun run test
cd .. && bun run build
```

Backend TypeScript is strict and must keep logic injectable enough for synthetic Bun tests. Web
TypeScript additionally uses `verbatimModuleSyntax` and `erasableSyntaxOnly`. Build output is staged
then atomically swapped into `web/dist`.

## Data-path reminders

- Collie uses React Router loaders and HTTP polling, not TanStack Query or WebSockets.
- Native routes are `/`, `/space/:spaceId`, `/settings`, `/pane/:paneId`, and
  `/pane/:paneId/history`; `?session=<name>` selects a named Herdr instance on that node.
- Herdr RPC is one request per connection except `events.subscribe`; request ids are strings.
- Pane output is React text, never `innerHTML`.
- Every agent journal path must pass realpath containment under its configured harness root.

`AGENTS.md` points here so all coding agents receive the same rules.
