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

The Fleet page is a mobile-first Collie shell: one compact row switches instances, a header menu
triages Agents across every Host, and one width-limited iframe renders the selected node's native
Collie home, session, and pane routes. The aggregate contains only Agent-card metadata; Fleet never
copies terminal contents or histories into its central data model.

The compact header identifies the Agent menu with an Agent symbol and an inline count covering
`Needs you`, `Ready · unseen`, and `Working`; `Recent` cards do not contribute to that number. An
offline card keeps the section and count treatment implied by its last successfully observed state
while remaining visibly stale. The adjacent arrow-leaving-a-square control opens the selected
Collie in a new tab. Fleet intentionally exposes no logout button in this header.

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
- The Fleet Agent menu groups live and visibly stale cards under `Needs you`, `Ready · unseen`,
  `Working`, and `Recent` across all named sessions. An offline card stays interleaved according to
  its last-known status. Choosing one switches the existing iframe to that exact inventory Host,
  session, and Pane.
- Fleet may frame only the exact enabled node origins. Node HTML may be framed only by the exact
  Fleet origin; APIs, assets, Fleet itself, and every unknown host remain non-embeddable.
- Every Collie and Gateway listener is loopback-only. TLS is the operator's reverse proxy's job.
- The plugin's own detached supervisor restarts children with capped backoff. Herdr startup and
  lifecycle hooks idempotently ensure it; it exits after Herdr/plugin health stays absent for a
  grace period. No systemd, launchd, cron, or pidfile is created.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the boundaries and [UPSTREAM.md](./UPSTREAM.md) for
the exact Collie base.

### Fleet Agent refresh

Opening an authenticated Fleet page requests the aggregate immediately. Opening the Agent menu sends
a manual reset with the same request. The Gateway—not each browser tab—owns one adaptive schedule for
the whole aggregate. If a completed collection cycle does not change the visible state, that shared
delay doubles from the effective five-second base to 10 seconds, 20 seconds, and later delays, capped
at one hour. A visible Agent/session/health change or manual reset returns the shared delay to its
base. Browsers receive the canonical next-refresh time and merely schedule their next read from it.

Independently of that one shared backoff, every configured Host has a hard five-second minimum
between the starts of primary snapshot attempts, including attempts that fail. Page loads, menu
opens, retries, and multiple tabs cannot bypass the floor. A request that arrives too early receives
the in-memory aggregate and earliest legal next time without revisiting the Host. Primary discovery
and its reachable named-session fan-out form one Host transaction; named sessions do not acquire
separate backoffs. Overlapping eligible requests are coalesced, and no fixed collector loop polls
nodes while no Fleet page is open unless central Discord Agent notifications are enabled. When they
are enabled, one Gateway-owned wakeup advances this same adaptive schedule in the background; it
does not create another collector, Host visit, or exponential-backoff sequence.

If a Host or one named Herdr session becomes unreachable, its last successful cards stay interleaved
in their last-known triage sections, dimmed and labelled offline with their Host and last observation
age. This cache is memory only and is never presented as live. A later successful snapshot is
authoritative: recovered Agents move to their current status section and Agents no longer reported
disappear. Fleet projects only the card fields needed for this view; Pane output, history,
credentials, update state, device authorization, and unknown snapshot fields remain excluded.

## Requirements

- Herdr 0.8.0 or newer
- Bun
- A reverse proxy providing HTTPS
- OpenSSH on the Fleet host only when remote nodes use the SSH transport
- `pingme` on the Fleet host only when central Discord Agent notifications are enabled

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
HERDR_WEB_FLEET_URL=https://herdr.example.com/
HERDR_WEB_INSTANCE_ID=local
```

`COLLIE_MULTI_SESSION=1` makes the node UI discover the primary session and all running named
sessions. On a shared home, set `HERDR_WEB_HOST_PREFIX` to the stable Herdr host's hostname prefix;
scheduler jobs are denied by default. `HERDR_WEB_FLEET_URL` must be the HTTPS Fleet origin root,
and `HERDR_WEB_INSTANCE_ID` must match this node's stable Gateway inventory id. They are public
routing metadata used by the optional Pane-link shortcut; they are not credentials.

A remote node is deliberately a **zero-central-secret** installation. Its `.env` stops at the
Collie/node settings above: do not set `HERDR_WEB_GATEWAY_CONFIG`, and do not copy `gateway.json`,
the Fleet password hash, session-signing secret, SSH private keys, or another node's files to it.
The remote supervisor then starts Collie only. The central Fleet host reaches that loopback listener
through SSH; the remote plugin never calls back to Fleet and needs no application token.

### Copy the focused Pane's Fleet link

After setting the two public routing variables above, add this portable binding to the Herdr config
that owns the session:

```toml
[[keys.command]]
key = "prefix+ctrl+r"
type = "plugin_action"
command = "memset0.web-remote.copy-pane-url"
description = "copy Web Remote Pane URL"
```

Focus a Pane, press the configured prefix, then `Ctrl+R`. The action copies the canonical outer
Fleet link, for example
`https://herdr.example.com/?instance=local&pane=w0%3Ap3`; a named Herdr session also gets its
URL-encoded `session` selector. The link never contains the password, cookie, Gateway config, SSH
identity, or any Pane contents. A browser without a current Web Remote cookie still passes through
the normal login and then returns to the same deep link.

For `herdr --remote`, connect with the remote server's keybindings:

```bash
herdr --remote <target> --remote-keybindings server
```

Herdr 0.8 defaults remote attaches to a snapshot of the viewing computer's local keybindings and
deliberately omits custom command bindings from that snapshot. Consequently, a Web Remote binding
installed on the remote server cannot fire in the default `local` mode. Keybinding mode is chosen
during the client handshake: after installing or changing this binding, detach and reconnect with
`--remote-keybindings server`; `herdr server reload-config` alone cannot switch an already attached
local-keybindings client. A direct local attach, or SSH followed by running `herdr` on the node,
already uses the server configuration and needs no extra flag.

The action deliberately opens a tiny transient plugin popup and emits one OSC 52 clipboard write.
Herdr consumes that write and, for a server-keybindings `herdr --remote` attach, forwards it only to
the foreground viewing client, so the clipboard belongs to the computer at which you are working
rather than the server.
The popup closes after a short drain interval and does not create a Pane or change the tab layout.
If the terminal blocks OSC 52, its clipboard policy remains authoritative. Missing or invalid
routing metadata fails closed and writes no clipboard payload; inspect the Web Remote plugin action
log after correcting the two public variables.

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
inventory entries. Its existing `pollIntervalMs` is the Gateway-owned adaptive-refresh base (5000
by default and clamped to the five-second Host revisit floor), not an unconditional server polling
loop. The live Gateway config must remain an absolute-path, owner-only file.

### Discord Agent notifications

The central Gateway can notify Discord when a successfully fetched Agent newly enters green
`done` or red `blocked` (`Needs You`). The first successful observation is a silent baseline, an
unchanged or offline cached card never repeats an alert, and recovery is compared with the last
successfully fetched state. Monitoring uses the exact Fleet refresh state described above: one
adaptive 5-second-to-1-hour delay and the same hard five-second per-Host floor for browser and
notification activity together.

Install and privately configure `pingme` only on the Fleet host, under the same account that runs
the plugin-owned supervisor. Then add this object to the owner-only `gateway.json`:

```json
"discordNotifications": {
  "enabled": true,
  "executable": "/usr/local/bin/pingme",
  "channel": "test"
}
```

`executable` must be an absolute regular executable file. `channel` is passed as an explicit
`pingme` channel id or configured alias; the initial validation rollout should use a dedicated
`test` alias before a later configuration change selects a production destination. Gateway never
reads or distributes the CLI's token, webhook, or private config, and remote nodes need no Discord
settings.

Each default-template message includes the Agent, `completed`/`needs you` state, Host, workspace,
Tab, Pane, optional named Herdr session, and a clickable canonical Fleet Pane link. It includes no
terminal contents, history, cookie, credential, or SSH material. For example:

```text
🟢 Agent completed
Agent: codex
Host: Cluster A
Workspace: Example project
Tab: Main
Pane: Review (w0:p7)
Open Pane in Fleet: https://herdr.example.com/?instance=cluster-a&pane=w0%3Ap7
```

Omitting `template` uses `pingme`'s existing default template. A custom selector can be supplied as
`"template": "fleet-alert"`; Fleet forwards the selector unchanged, so an absolute `.md` path also
works once the installed `pingme` version supports absolute template selectors. Custom templates
receive `agent`, `status`, `status_label`, `host`, `host_id`, `workspace`, `workspace_id`, `tab`,
`tab_id`, `pane`, `pane_id`, `session`, `observed_at`, and `pane_url` variables in addition to the
complete default `message`. Delivery uses one direct, timeout-bounded child process at a time, never
a shell; a failed transition is diagnosed once and not automatically retried.

An SSH transport may omit `jump` for a direct connection or add the structured `jump` object shown
in `gateway.example.json` when the target is reachable only through a bastion. The jump endpoint has
its own absolute private-key and pinned known-hosts paths. Gateway builds both SSH layers with
`-F /dev/null`, strict host-key checking, batch-only public-key authentication, no agent forwarding,
and no connection multiplexing; it does not inherit an operator's `~/.ssh/config`. The outer target
still owns exactly one loopback `-L`, while the jump process is limited to the stdio connection
needed by that target. A transport remains `starting` until its local forward actually accepts a
connection, and failed attempts retain capped exponential backoff.

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
two enabled nodes whose target identity paths or private-key contents match. A jump identity must
also differ from every enabled target identity; one bastion identity may serve multiple jumped
nodes. Removing a node therefore means deleting only its inventory entry and central target private
key plus its one remote public-key line; rotating it does not affect other nodes.

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

### Version compatibility

Patch versions within one major/minor line are deployment-compatible. For example, a `2.0.4`
central Gateway may continue serving a remote node on `2.0.2`; patch-only changes do not require
remote plugin reinstallation and nodes may update later. A change that requires remote plugins to
be reinstalled increments the minor version and is not released until the operator approves the
exact target version and rollout. The major version changes only on an explicit operator directive.

Normal validation runs `scripts/check-version.sh`. A release additionally runs
`scripts/check-version.sh --release`, which compares the candidate to the latest strict `vX.Y.Z`
tag, rejects skipped or malformed transitions, and enforces exact approval for minor and major
releases.

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
cd web && bun install --frozen-lockfile && bun run typecheck && bun run test
cd .. && bun run build
```

The project remains MIT licensed and retains Collie's upstream copyright/history. Keep fixtures,
docs, and examples synthetic; never commit deployment credentials or runtime/session data.
