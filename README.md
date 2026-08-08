# Herdr Web Remote

Herdr Web Remote adds a password-protected public Fleet dashboard and one native
[Collie](https://github.com/AltanS/collie) UI per Herdr host. It is a Herdr 0.8+ plugin and does
not install a system service, configure Tailscale, or expose a raw bridge port.

The Collie-derived node UI can inspect and control panes, switch among every locally discovered
named Herdr session, and keep its native deep links:

```text
https://node.herdr.example.com/?session=<session-name>
https://node.herdr.example.com/pane/<pane-id>?session=<session-name>
```

The Fleet page is a mobile-first Collie shell: one compact row switches instances while one
width-limited iframe renders the selected node's native Collie home, session, and pane routes. It
does not reimplement Collie's dashboard or copy terminal contents into a central data model.

## Architecture

```text
browser ──HTTPS── reverse proxy ──loopback── Fleet Gateway
                                            ├── local Collie ── Unix socket ── Herdr
                                            └── SSH -L ── remote Collie ───── Herdr
```

- One Argon2id-backed username/password; no registration, users, roles, or tenant isolation.
- One signed `Secure; HttpOnly; SameSite=Lax` cookie covers the Fleet base domain and node
  subdomains.
- Gateway routes by exact `Host`, strips its session credential, then transparently proxies the
  stock Collie path/query/method/body/response.
- Fleet may frame only the exact enabled node origins. Node HTML may be framed only by the exact
  Fleet origin; APIs, assets, Fleet itself, and every unknown host remain non-embeddable.
- Every Collie and Gateway listener is loopback-only. TLS is the operator's reverse proxy's job.
- The plugin's own detached supervisor restarts children with capped backoff. Herdr startup and
  lifecycle hooks idempotently ensure it; it exits after Herdr/plugin health stays absent for a
  grace period. No systemd, launchd, cron, or pidfile is created.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the boundaries and [UPSTREAM.md](./UPSTREAM.md) for
the exact Collie base.

## Requirements

- Herdr 0.8.0 or newer
- Bun
- A reverse proxy providing HTTPS
- OpenSSH on the Fleet host only when remote nodes use the SSH transport

Linux and macOS are supported. The plugin and its long-running processes run as the same account
that owns the target Herdr socket.

## Build and install

Herdr's GitHub installer runs the manifest build. A linked checkout must be built first:

```bash
./memconf-build.sh
herdr plugin link "$(pwd)" --enabled
herdr plugin action invoke ensure --plugin memset0.web-remote
```

The build uses frozen Bun lockfiles, typechecks the bridge/Gateway/supervisor and web app, builds to
a staging directory, then swaps the completed PWA into place.

## Node configuration

Herdr reports the config directory:

```bash
config_dir="$(herdr plugin config-dir memset0.web-remote)"
install -m 0600 .env.example "$config_dir/.env"
```

Set an exact node hostname in both variables:

```dotenv
COLLIE_HOST=127.0.0.1
COLLIE_PORT=8787
COLLIE_SKIP_SERVE=1
COLLIE_PUBLIC_HOSTS=local.herdr.example.com
COLLIE_ALLOWED_ORIGINS=https://local.herdr.example.com
COLLIE_MULTI_SESSION=1
```

`COLLIE_MULTI_SESSION=1` makes the node UI discover the primary session and all running named
sessions. On a shared home, set `HERDR_WEB_HOST_PREFIX` to the stable Herdr host's hostname prefix;
scheduler jobs are denied by default.

A remote node is deliberately a **zero-central-secret** installation. Its `.env` stops at the
Collie/node settings above: do not set `HERDR_WEB_GATEWAY_CONFIG`, and do not copy `gateway.json`,
the Fleet password hash, session-signing secret, SSH private keys, or another node's files to it.
The remote supervisor then starts Collie only. The central Fleet host reaches that loopback listener
through SSH; the remote plugin never calls back to Fleet and needs no application token.

## Fleet host configuration

The Fleet host uses the same node configuration and additionally sets:

```dotenv
HERDR_WEB_GATEWAY_CONFIG=/absolute/path/to/gateway.json
```

Generate a protected single-node config and one-time credential without embedding any secrets in
the repository:

```bash
bun run scripts/generate-config.ts \
  --config-dir "$config_dir" \
  --fleet-host herdr.example.com \
  --base-domain herdr.example.com \
  --node-host local.herdr.example.com
```

The command refuses to overwrite `.env` or `gateway.json`, creates both as mode 0600, and prints the
new username/password once. Use a dedicated cookie base (for example `herdr.example.com`) rather
than a parent shared by unrelated applications. `gateway.example.json` documents local and SSH
inventory entries. The live Gateway config must remain an absolute-path, owner-only file.

For each SSH node, generate a new key on the Fleet host and never reuse or agent-load it. Keep its
private half and pinned host-key data on Fleet only; copy only that node's `.pub` line to the remote
account. For example, using synthetic names:

```bash
install -d -m 0700 /home/operator/.config/herdr-web/ssh
ssh-keygen -q -t ed25519 -N '' \
  -f /home/operator/.config/herdr-web/ssh/cluster-a
```

The remote `authorized_keys` entry should grant only the required forwarding destination. Modern
OpenSSH accepts this form (replace the placeholder with the contents of `cluster-a.pub`):

```text
restrict,port-forwarding,permitopen="127.0.0.1:8787" <cluster-a-public-key>
```

`restrict` keeps PTY, agent, X11, and user-rc access disabled; `port-forwarding` re-enables forwarding
only, and `permitopen` limits the `-L` destination. Validate the target OpenSSH behavior before
enrollment and fail closed on older servers rather than installing an unrestricted key.

Gateway additionally ignores user/system SSH configuration, disables connection multiplexing and
all ambient authentication mechanisms, and opens one explicit batch-mode loopback `-L`. It rejects
two enabled nodes whose identity paths or private-key contents match. Removing a node therefore
means deleting only its inventory entry and central private key plus its one remote public-key line;
rotating it does not affect other nodes.

Point every concrete Fleet/node hostname at the Gateway loopback listener in the reverse proxy. A
true wildcard certificate is optional; listing concrete hosts works with ordinary ACME HTTP
challenges.

## Lifecycle

```bash
herdr plugin action invoke ensure  --plugin memset0.web-remote
herdr plugin action invoke status  --plugin memset0.web-remote
herdr plugin action invoke restart --plugin memset0.web-remote
herdr plugin action invoke stop    --plugin memset0.web-remote
```

`ensure` is concurrency-safe and replaces an older code generation. `stop` affects only Web Remote;
it does not stop Herdr or any pane. Logs and runtime state live in the plugin state directory with
owner-only permissions. The control socket is node-local (`$XDG_RUNTIME_DIR`, or the OS temporary
directory), so a shared-home pidfile cannot make one cluster node manage another.

## Security model

Authenticated Collie access is equivalent to terminal control as the Herdr account. Keep these
invariants:

- Gateway and Collie bind loopback only; expose only the TLS reverse proxy.
- Keep the operator password hash, session-signing secret, full inventory, every SSH private key,
  and pinned known-hosts files on the Fleet host only. Protect its `.env` and `gateway.json` as mode
  0600.
- Give every remote node a different SSH identity. A remote host receives only its own restricted
  public authorization and Collie configuration—never `gateway.json`, a private key, or a Fleet
  authentication value.
- Do not use SSH agent forwarding or a shared Fleet key. Gateway also removes its cookie and request
  `Authorization` before contacting Collie and refuses an upstream `Set-Cookie` that targets the
  Gateway cookie name.
- Keep exact public Host/Origin lists; unknown node hosts fail closed.
- Keep the generated frame policy exact. Do not replace configured Fleet/node origins with a
  wildcard or disable the Gateway's CSP/X-Frame-Options handling.
- Do not place another authentication proxy in front of only some node routes. Gateway authentication
  must cover every API and navigation uniformly.
- Static PWA update assets may load before login so an installed app can refresh; pane/session APIs
  and all navigations still require a valid session.

## Development

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
cd web && bun install --frozen-lockfile && bun run typecheck && bun run test
cd .. && bun run build
```

The project remains MIT licensed and retains Collie's upstream copyright/history. Keep fixtures,
docs, and examples synthetic; never commit deployment credentials or runtime/session data.
