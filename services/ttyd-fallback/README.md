# Emergency terminal companion

This directory contains the cross-platform emergency terminal shipped by
`memset0.web-remote`. It is part of the existing plugin release, not another plugin or operating
system service.

## Architecture and invariants

Every enabled Fleet node has one matching terminal inventory record and one supervisor-owned node
control socket. The Fleet host additionally runs one supervisor-owned ingress socket. These small
control processes remain available while Web Remote is active; idle state has no ttyd process,
writable Herdr attachment, SSH data connection, dynamic Caddy fragment, timer, or public terminal
port.

Fleet derives `/ttyd/<node-id>/` from the enabled node id. A top-level authenticated user navigation
may add one validated `pane` and optional named `session` selector. Ingress validates the existing
Fleet cookie locally, checks the exact Host and browser-controlled Fetch Metadata, and checks Origin
and Referer exactly when a top-level GET supplies them. Fleet's `no-referrer` navigation may omit
both without weakening the same-origin Fetch Metadata gate. Ingress then activates the fixed node
control protocol and redirects to a selector-free URL. It never calls Gateway or Collie and the
browser cannot choose a command, terminal id, socket, host, or undeclared session.

The landing document embeds ttyd only in the wide fine-pointer presentation and renews a fixed
1,800-second lease only while visible. One node and one terminal WebSocket client may be active.
Another node receives a conflict. Disconnect, expiry, transport loss, supervisor replacement, or
manual disable removes ttyd, its client-only `herdr terminal attach`, its Unix socket, and ephemeral
state without restarting Herdr or changing a Pane.

Local nodes use their owner-only Unix sockets directly. SSH nodes use one host-key-pinned identity
resolved below the Fleet host's protected live root. That identity must be restricted to the fixed
`stdio_unix_relay.py --config <absolute-node.json>` command. The relay distinguishes the strict
versioned control message from authenticated HTTP/WebSocket data and cannot execute an SSH command,
allocate a PTY, forward a port or choose another node.

## Inventory and installation

[`inventory.example.json`](./inventory.example.json) is the schema-3 synthetic template. A real
owner-only inventory contains every enabled Gateway node exactly once. There is no `enabled`,
`pending`, public URL, fallback flag, general-purpose control key, or node-specific executable path.
Differences are data only: platform, architecture, owner, Herdr socket/session, runtime/install
paths, binary identity, host/job gate, and local or SSH transport.

Install or verify a node payload without starting ttyd:

```bash
services/ttyd-fallback/ttyd-fallback install \
  --inventory /absolute/private/terminal-inventory.json \
  --node local-a
```

Linux x86_64/aarch64 nodes may use the pinned release asset. Darwin nodes use the same command with
an explicit `local_path`, SHA-256 and version output for a reviewed package-manager binary. Both
paths verify native format, architecture, digest, version, required ttyd flags and atomic replacement.
Python 3.10 or newer is required. The installed node payload contains only ttyd, `node.py`,
`protocol.py`, `platform_support.py`, `stdio_unix_relay.py`, and the protected derived `node.json`.

Configure the existing plugin supervisor on every node:

```dotenv
HERDR_WEB_TERMINAL_NODE_CONFIG=/absolute/install/root/node.json
HERDR_WEB_TERMINAL_PYTHON=/usr/bin/python3
```

The Fleet host also configures the protected terminal inventory, existing Gateway configuration and
SSH live root:

```dotenv
HERDR_WEB_GATEWAY_CONFIG=/absolute/private/gateway.json
HERDR_WEB_TERMINAL_FLEET_CONFIG=/absolute/private/terminal-inventory.json
HERDR_WEB_TERMINAL_LIVE_ROOT=/absolute/private/terminal-live
HERDR_WEB_TERMINAL_INGRESS_SOCKET=/absolute/caddy-traversable/terminal-ingress.sock
HERDR_WEB_TERMINAL_INGRESS_GID=123
```

The supervisor refuses a partial central configuration. Ingress refuses startup unless both files
are owner-only and the terminal node ids exactly equal the enabled Gateway ids. It owns a dedicated
0710 parent and 0660 socket for the declared reverse-proxy GID; node control and ttyd sockets remain
0600 elsewhere. A reverse proxy may then route the exact `/ttyd/<node-id>/` family to the stable
ingress socket; route creation and Caddy reload are deployment operations, never activation steps.

## Status and recovery

Validate the inventory or inspect the dormant node-control services through the same bounded CLI:

```bash
services/ttyd-fallback/ttyd-fallback \
  --inventory /absolute/private/terminal-inventory.json \
  --live-root /absolute/private/terminal-live \
  validate

services/ttyd-fallback/ttyd-fallback \
  --inventory /absolute/private/terminal-inventory.json \
  --live-root /absolute/private/terminal-live \
  status [node-id]
```

Close one node or the whole inventory without touching Herdr, Collie, Gateway, or Panes:

```bash
services/ttyd-fallback/ttyd-fallback \
  --inventory /absolute/private/terminal-inventory.json \
  --live-root /absolute/private/terminal-live \
  disable [node-id]
```

Restarting the Web Remote supervisor also converges every node to dormant before publishing its
control socket. Cleanup matches PID, process start token and command markers on Linux and Darwin, so
stale metadata cannot signal a reused unrelated process.

## Security and tests

Ingress removes browser `Authorization`, Fleet cookies and forged trusted-identity headers before
injecting the configured owner identity. ttyd listens only on an owner-protected Unix socket, checks
the Fleet Origin, accepts one writable client, disables URL commands and records no transcript.
Credentials, signing material, SSH keys, terminal content and runtime state must remain outside the
public repository and logs.

Run the synthetic protocol, installer, lifecycle, authentication and cleanup suite with:

```bash
services/ttyd-fallback/test/run.sh
```

The pinned upstream identity and audit record are in [`UPSTREAM.md`](./UPSTREAM.md).
