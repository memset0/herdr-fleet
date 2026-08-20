# ttyd fallback companion

This directory is the normally closed emergency-terminal service shipped with the
`memset0.web-remote` Herdr plugin. It is not another plugin and has no startup or event hook. A
normal plugin build, registration, `ensure`, restart, or update does not start ttyd, a transport,
an authentication helper, a route, a lease timer, or another supervisor.

The companion attaches ttyd to one terminal that already belongs to a running Herdr Pane. It reads
the configured Herdr snapshot, resolves an operator-selected or focused Pane to its fixed
`terminal_id`, and executes only `herdr terminal attach <terminal_id>`. Browser paths and query
arguments cannot select a command, host, session, Pane, or terminal.

## Public product versus private deployment

The service implementation, synthetic inventory example, ttyd pin, and tests live here. A real
deployment supplies an external owner-protected inventory and keeps its hostnames, socket/session
names, SSH identities, Caddy layout, credential verifier, generated state, and runtime findings
outside this repository. See `inventory.example.json` for the schema; do not turn it into a real
inventory.

Each enabled node requires an explicit architecture, owner, Python and Herdr executable, Herdr
session/socket namespace, node-local runtime and install paths, public fallback hostname, and local
or SSH transport. SSH control uses an explicit absolute `control_identity`; the companion never
reads ambient SSH config or chooses a default key. Its separate relay identity is resolved beneath
the controller's live config root and should be installed remotely with `restrict` plus one fixed
`stdio_unix_relay.py --config .../node.json` command.

## Install without starting

Linux x86_64 and aarch64 use the pinned ttyd release and checksum in this directory:

```bash
services/ttyd-fallback/ttyd-fallback install \
  --inventory /absolute/private/inventory.json \
  --node local-a
```

The inventory's `install_root` receives the verified binary and companion controls. Installation
does not activate them. Python 3.9 or newer is required for the runtime controls; the Web Remote
plugin itself continues to support macOS, but this ttyd companion is Linux-only.

## Central preparation and bounded activation

Run the controller only on the trusted ingress host and pass every deployment-specific path
explicitly when it differs from the generic defaults:

```bash
services/ttyd-fallback/ttyd-fallback \
  --inventory /absolute/private/inventory.json \
  --live-root /absolute/private/config/ttyd-fallback \
  --caddy-import 'import /etc/caddy/herdr-web-remote.d/*.caddy' \
  prepare --username operator

services/ttyd-fallback/ttyd-fallback \
  --inventory /absolute/private/inventory.json \
  --live-root /absolute/private/config/ttyd-fallback \
  enable local-a --lease 1800

services/ttyd-fallback/ttyd-fallback \
  --inventory /absolute/private/inventory.json \
  --live-root /absolute/private/config/ttyd-fallback \
  status

services/ttyd-fallback/ttyd-fallback \
  --inventory /absolute/private/inventory.json \
  --live-root /absolute/private/config/ttyd-fallback \
  disable
```

Preparation creates only owner-protected credentials/configuration, relay keys for configured SSH
nodes, the static landing asset, and an empty fragment directory. Activation is a separate explicit
operation with a 30-second to two-hour lease. It starts an owner-only node Unix socket, a local or
restricted-SSH stdio broker, an independent Basic-auth helper, and a temporary Caddy route in that
order. Failure unwinds in reverse order. Manual disable, lease expiry, lost component health, or a
later cleanup removes the route, broker, helper, ttyd process, socket, and ephemeral state without
stopping Herdr or changing Panes.

The authentication verifier stays only on the ingress host. ttyd requires the trusted header that
Caddy injects after authentication, validates the exact Origin, accepts one writable client, never
enables URL arguments, and writes no terminal transcript. Same-UID processes remain outside the
claimed security boundary.

## Tests

```bash
services/ttyd-fallback/test/run.sh
```

The tests use only temporary synthetic identities, paths, sockets, and fake Herdr/ttyd executables.
