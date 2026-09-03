# Herdr Fleet downstream runtime

Herdr Fleet adds an authenticated Herdr plugin boundary to the exact Collie baseline recorded in
[`FORK.toml`](../FORK.toml). Collie's PWA, bridge API, multiplexer adapters, Pack implementation, and
standalone deployment alternatives remain upstream behavior.

The first v3 stage is deliberately solo. It provides one Fleet lead profile, one Collie process,
one password/session Gateway, and one public HTTPS origin. It does not implement peers, SSH,
multi-host routing, Fleet-specific navigation, ttyd, or Fleet-specific aggregate/external
notifications. Collie's native optional Web Push remains available unchanged.

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

Every table rejects unknown fields. `peer`, `hosts`, `transport`, `ssh`, and `pack` are not dormant
options in version 1: supplying one fails startup without partially enabling it. The Pack trust and
operations JSON files remain Collie-managed state and are never configuration inputs.

Do not commit a complete configuration, password hash, signing secret, session state, hostname,
device mapping, or private path. Public tests construct synthetic values in temporary directories.

## Authentication boundary

The Gateway owns `/auth/login` and `/auth/logout`. A successful login verifies the configured
Argon2id hash and returns a signed `__Host-` cookie backed by an owner-only active-session registry.
The cookie is Secure, HttpOnly, SameSite=Strict, Path=/, and has no Domain attribute. Logout revokes
the current server-side session before clearing the cookie.

All document navigations and `/api/*` requests require a current session before Collie is contacted.
Only the authentication stylesheet and an exact set of PWA update assets are public. The service
worker sends every document navigation to the network first, so an expired or logged-out session
cannot recover an old authenticated app shell. `/pack/*` is not exposed by this stage.

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
- `status` reports only safe generation, component, PID, and readiness facts.
- `restart` replaces the supervisor's own Collie and Gateway children.
- `stop` closes the private control socket and only those direct children.
- `url` prints the configured public origin.

The supervisor uses no operating-system service, pid-file discovery, port-based killing, or broad
process-name matching. Its private Unix control socket is generation-qualified; child crashes use a
bounded restart delay. Logs and session state stay beneath the owner-only plugin state directory.

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
