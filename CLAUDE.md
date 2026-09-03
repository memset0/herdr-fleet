# Working agreement

Herdr Web Remote (`memset0.web-remote`) is a public-ready Herdr 0.8.2+ plugin derived from Collie.
Read `README.md`, `README.full.md`, `ARCHITECTURE.md`, `UPSTREAM.md`, and `HERDR_API.md` before
changing boundaries.

## Documentation

`README.md` is the concise project landing page. `README.full.md` is the maintained comprehensive
feature reference, not a frozen archive. Every change to user-visible Fleet or Collie behavior,
shortcuts, topology, security boundaries, fallback behavior, or lifecycle MUST update
`README.full.md` in the same change and preserve the links between the two documents. When
`INSTALL.md` is present, keep it as the single installation authority; the full reference may
explain operational context but must not become a second agent-install workflow.

## Non-negotiable boundaries

- Never commit credentials, private deployment names/paths, live terminal/session data, SSH keys,
  or parent-repository context. Examples and tests stay synthetic.
- Keep Gateway and Collie loopback-only. The Gateway remains the uniform authentication boundary;
  every Collie data/API/navigation route is protected, while only static PWA update assets may be
  public.
- Preserve Collie's Host/Origin, CSP, text-node rendering, filesystem containment, and prompt-binding
  security invariants.
- Preserve v0.36.1's fail-closed Host allowlist, loopback bind/peer checks, proxy-auth recovery, and
  upload magic-byte validation. A deployment-specific Gateway does not weaken the node Bridge.
- The supported lifecycle is the plugin-owned supervisor. Do not add systemd, launchd, cron,
  Tailscale, a public listener, or a shared-home pidfile.
- Keep Fleet aggregation to stable, explicitly allowlisted summary and Agent-card fields. Pane
  contents and histories stay on the native node route; only a confirmed Discord alert may make one
  bounded, side-effect-free History read and forward its newest Assistant text without retaining it.

## Versioning

`herdr-plugin.toml`, root `package.json`, `web/package.json`, and the newest `CHANGELOG.md` heading
must agree. Functional changes require a SemVer bump and a concise changelog entry citing the short
feature commit. Patch releases are mutually compatible within one major/minor line: central and
remote nodes may run different `X.Y.z` versions, and remote nodes may defer those updates. Use a
minor release when a change requires remote plugins to be reinstalled; report that rollout impact
to the owner and obtain explicit approval for the exact version before tagging or pushing it. The
major version changes only on an explicit owner directive and likewise requires exact approval.

Run `scripts/check-version.sh` during development and `scripts/check-version.sh --release` after the
release commit. The release gate accepts only the next patch, minor, or major version. Minor and
major gates respectively require `WEB_REMOTE_MINOR_RELEASE_APPROVAL=X.Y.Z` or
`WEB_REMOTE_MAJOR_RELEASE_APPROVAL=X.Y.Z`; never infer or pre-fill either approval. Tag releases as
`vX.Y.Z` only after the release gate passes.

## Fork boundary

Read [`FORK.toml`](./FORK.toml) before changing any Collie-owned path. Put substantive downstream
behavior in a declared owned module first, and expose only the smallest typed host port that the
owned module requires. Update the manifest in the same commit whenever a path, anchor, ownership
boundary, or verification contract changes; the manifest describes only the current fork, while
Git and OpenSpec retain history.

Run `bun run scripts/check-fork.ts` for normal boundary verification. Before synchronizing another
Collie release, run `bun run scripts/review-upstream.ts --target <commit>` and complete the generated
review for every invasive entry, including entries whose files the target did not change.

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
- `commands.toml`, `keys.toml`, and `quick-replies.toml` share one last-good operator-file and scope
  contract; extend all three consistently without moving their values into Fleet.

`AGENTS.md` points here so all coding agents receive the same rules.
