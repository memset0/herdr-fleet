# Herdr Fleet downstream runtime

Herdr Fleet adds an authenticated Herdr plugin boundary to the exact Collie baseline recorded in
[`FORK.toml`](../FORK.toml). Collie's PWA, bridge API, multiplexer adapters, Pack implementation, and
standalone deployment alternatives remain upstream behavior.

Schema 1 remains the deliberately solo-compatible Fleet lead profile: one Collie process, one
password/session Gateway, and one public HTTPS origin. Schema 2 adds only the role-aware foundation
for selecting Collie's native Pack authority. It does not implement SSH reachability, enroll a
member, contact a peer, aggregate Hosts, distribute software, or replace Collie's native Pack
router, loaders, and UI. Collie's native optional Web Push remains available unchanged.

The full Collie Pack security harness for this baseline is verified on Bun 1.3.14. Its pinned-client
TLS canary does not hold on Bun 1.3.12, so Pack or later multi-host behavior must not be enabled on an
older, unverified Bun runtime. The first schema keeps Pack unconfigured and exposes no Pack route.

## Private configuration

The runtime reads `fleet.toml` only from `HERDR_FLEET_CONFIG` or from `fleet.toml` beneath the
Herdr-provided plugin configuration directory. The resolved file must be owner-only (`0600`) and
must live outside the source checkout. The repository ignores a root `fleet.toml` as a final guard,
but an ignored checkout file is not the recommended live location.

Schema version 1 accepts these fields:

| Table | Fields | Contract |
| --- | --- | --- |
| root | `schema_version`, `role` | Version is `1`; role is exactly `lead`. |
| `listen` | `host`, `port` | Gateway listener; host is loopback. |
| `public` | `origin` | One exact HTTPS origin with no path, query, fragment, or user information. |
| `collie` | `host`, `port` | One distinct loopback Collie endpoint. |
| `auth` | `username`, `password_hash`, `session_secret`, `session_ttl_seconds` | One account, an approved Argon2id hash, at least 32 random base64url secret bytes, and a bounded lifetime. |
| `auth.rate_limit` | bounded failure/window/block/source and aggregate fields | Optional overrides for the finite login budgets. |
| `proxy` | `client_ip_header` | Header the loopback HTTPS proxy replaces with one client IP. |

Every table rejects unknown fields. `peer`, `hosts`, `transport`, `reachability`, `ssh`, and `pack`
are not dormant options in version 1: supplying one fails startup without partially enabling it. The Pack trust and
operations JSON files remain Collie-managed state and are never configuration inputs.

Do not commit a complete configuration, password hash, signing secret, session state, hostname,
device mapping, or private path. Public tests construct synthetic values in temporary directories.

Schema version 2 selects Collie's native Pack lifecycle without copying its trust state:

| Role | Required tables | Runtime |
| --- | --- | --- |
| `lead` | root, `lifecycle`, `listen`, `public`, `collie`, `auth`; optional `auth.rate_limit`, `proxy` and `reachability` | One loopback Collie plus one loopback authenticated Gateway. |
| `peer` | root, `lifecycle`, `collie`, `transport` | One loopback Collie plus one supervised SSH link; no Gateway, browser account, session store, or public listener. |

Both roles require:

```toml
schema_version = 2
role = "peer" # or "lead"

[lifecycle]
mode = "native-pack"
pack_state = "collie"

[collie]
host = "127.0.0.1"
port = 8787
```

A Lead then supplies the same synthetic-shape Gateway tables documented for schema 1. A Peer must
not supply them. Neither role accepts members, Pack secrets, certificates, fingerprints, passwords,
remote commands, or alternate trust paths.

### Reachability

Reachability is the operator's, exactly as `PACK_PROTOCOL.md` §8.2 states: Collie authenticates a
member, and nothing here does. A Peer opens one outbound SSH connection carrying two loopback
projections and nothing else — a remote projection publishing this Peer's own `[collie]` endpoint at
a Lead-local address, and a local projection publishing the Lead's Collie at a Peer-local address.
The Peer's own projected endpoint is derived from `[collie]` rather than restated here.

```toml
[transport]
mode = "ssh-reverse"
ssh_host = "lead.example.com"
ssh_port = 22
ssh_user = "fleet-tunnel"
identity_file = "/private/fleet/id_ed25519"
known_hosts_file = "/private/fleet/known_hosts"
lead_bind_host = "127.0.0.1"
lead_bind_port = 18901
peer_bind_host = "127.0.0.1"
peer_bind_port = 18902
lead_collie_host = "127.0.0.1"
lead_collie_port = 8787
retry_max_seconds = 60
```

A Lead names where it dials each member, and only that:

```toml
[[reachability]]
member_id = "peer-a"
host = "127.0.0.1"
port = 18901
```

`mode` admits exactly `ssh-reverse`; a mode with no runtime behind it is refused rather than accepted
as dormant. Every projection bind must be loopback, a Lead rejects `[transport]`, a Peer rejects
`[[reachability]]`, and neither table accepts trust material of any kind. The identity file must be
owner-only and is checked before a connection is attempted.

The link is restricted by construction: no remote command, shell, or PTY; no inherited user SSH
configuration; no agent, X11, dynamic, or additional forwarding; no multiplexing; strict host-key
checking against the configured `known_hosts`; and `ExitOnForwardFailure`, so a projection that
cannot bind ends the attempt instead of leaving one direction silently missing. The Peer owns
recovery under bounded backoff capped by `retry_max_seconds`, and a link failure never restarts the
Collie child.

An established link asserts nothing. It grants TCP reachability and no membership, admission, or
role, and a dead link revokes nothing and changes no trust state. A Lead's `[[reachability]]` list is
a projection of the membership Collie already owns: its member ids must equal Collie's enrolled set,
checked read-only before any child starts, and a disagreement fails closed rather than being
reconciled.

Before a schema-2 child starts, Fleet uses Collie's existing trust reader and mode derivation against
the Collie child's isolated state directory. The configured role must match a valid active native
Lead or Peer state. Missing, invalid, conflicted, solo, or mismatched state fails closed. Fleet never
creates, repairs, enrolls, rotates, or otherwise writes that state.

## Authentication boundary

The Gateway owns `/auth/login` and `/auth/logout`. A successful login verifies the configured
Argon2id hash and returns a signed `__Host-` cookie backed by an owner-only active-session registry.
The cookie is Secure, HttpOnly, SameSite=Strict, Path=/, and has no Domain attribute. Logout revokes
the current server-side session before clearing the cookie.

All Lead document navigations and `/api/*` requests require a current session before Collie is contacted.
Only the authentication stylesheet and an exact set of PWA update assets are public. The service
worker sends every document navigation to the network first, so an expired or logged-out session
cannot recover an old authenticated app shell. The public Gateway never exposes `/pack/*`.

Login and logout require an exact-origin POST. Return targets are relative application paths rather
than user-provided URLs. Credential inputs, session files, attempt budgets, proxy bodies, headers,
and redirects are bounded or allowlisted, and authentication material is removed before a request
reaches Collie.

## Reverse-proxy contract

The public HTTPS proxy must:

1. Route the one configured public origin only to the loopback Fleet Gateway, never directly to
   Collie.
2. Preserve the exact public Host expected by `fleet.toml`.
3. Replace, rather than append, the configured client-IP header and discard the public caller's
   supplied forwarding value.
4. Leave the Gateway and Collie application ports unreachable from non-loopback networks.
5. Preserve no-store authentication responses and the Gateway's security headers.

The Gateway builds a new narrow upstream header set. It never forwards the Fleet cookie, browser
Authorization, forwarding headers, Tailscale identity, or device-trust assertions to Collie.

## Lifecycle

Herdr actions call the thin `scripts/herdr-fleet.sh` launcher:

- `start`/`ensure` starts one generation-qualified supervisor.
- `status` reports only safe generation, configured schema-2 role, component, PID, and readiness
  facts; schema-1 output remains unchanged.
- `restart` replaces only the supervisor's role-selected children.
- `stop` closes the private control socket and only those direct children.
- `url` prints the configured public origin.

The supervisor uses no operating-system service, pid-file discovery, port-based killing, or broad
process-name matching. Its private Unix control socket is generation-qualified; child crashes use a
bounded restart delay. Logs and session state stay beneath the owner-only plugin state directory.

A schema-2 Lead supervises Collie plus Gateway. A schema-2 Peer supervises Collie only and checks
that its loopback listener is accepting connections without attempting to bypass native Pack mTLS.
Fleet never starts a second Pack listener or projects that loopback endpoint off-host.

## Native Pack authority boundary

Fleet browser authentication and native Pack machine admission are independent. The Fleet cookie,
password material, session secret, and active session state are not placed in the Collie child
environment or translated into Pack credentials. The public Gateway returns not found for every
`/pack/*` path before proxying, including for an authenticated browser.

Collie's `pack-trust.json`, pinned certificates, Pack secret/signatures, role derivation, membership
transitions, strict no-grace rotation, member permissions, router, loaders, and native UI remain the
only Pack authority and implementation. Fleet reads that state only to confirm schema-2 role
agreement before startup. It adds no enrollment, rotation, sibling route, software-update authority,
or fallback secret.

## Native Web Push actions

Herdr Fleet exposes Collie's existing `push-keys` and `push-test` commands as fixed no-argument
plugin actions. They run through `scripts/collie-ctl.sh`, so Collie's own config-directory
resolution, mode-600 writes, existing-key refusal, subscription store, and diagnostics remain the
only implementation.

The actions do not enable Push automatically. Generate initial keys only when intended, invoke the
existing Fleet `restart` action so the running bridge reads them, then enable notifications in each
browser through Collie's Settings. The fixed `push-keys` action cannot rotate existing keys; forced
rotation and subscription list/forget operations remain terminal commands because they require
explicit arguments or review. See [`voice-and-push.md`](voice-and-push.md#web-push-optional) for the
native Collie workflow.

## Manual Pane fit

On a writable Herdr Pane, native Display Settings includes a `Resize` row directly below
`Text size`, marked `Custom`. A tap measures the current terminal mirror, converts its usable width
to complete monospace cells, clamps the result to 20–500 columns, and preserves the trusted current
viewport row count.

This is an explicit action only. Opening the drawer or changing the browser, font, route, or layout
does not resize the shared PTY. The bridge retains one no-takeover Herdr controller per session
socket and Pane, reuses it for later taps, reports ownership conflicts, and releases only its own
controllers when the Pane, session, or bridge ends. Browser requests carry columns only; socket paths
and rows stay server-owned. tmux, zellij, older bridges, unavailable Panes, and read-only clients do
not receive a usable action.

## Retained Collie deployment alternatives

Collie's Tailscale serve and `Tailscale-User-Login` implementation remains in the repository to keep
the upstream fork reviewable. The Fleet lead profile does not use it: the launcher forces loopback,
sets `COLLIE_SKIP_SERVE=1`, supplies the public Host/Origin, and removes conflicting inherited
Tailscale or device-trust values. In this profile the Fleet password/session Gateway is the public
authorization boundary; a retained upstream header check must not be treated as one.
