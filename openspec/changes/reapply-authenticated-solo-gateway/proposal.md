## Why

The Collie v1.2.0 baseline has no username/password session boundary of its own, so it cannot be
published safely as the first Herdr Fleet v3 staging service under the required account-based access
model. Herdr Fleet v2 already proved the core Gateway flow; v3 should reapply that owned behavior,
remove obsolete cross-subdomain assumptions, and harden the boundary before any UI or multi-host
work depends on it.

## What Changes

- **BREAKING**: establish the downstream plugin identity `memset0.herdr-fleet` on the v3 development
  line while preserving Collie attribution and the exact Collie v1.2.0 baseline.
- Introduce one strict, owner-only `fleet.toml` runtime configuration that is independent of Collie
  configuration and is never tracked as a live deployment file. This change supports the lead/solo
  role only; later peer and transport variants remain deferred.
- Reapply the v2 single-account username/password Gateway as a fork-owned module in front of one
  loopback Collie, with Argon2id password verification, signed time-bounded sessions, login/logout,
  safe return paths, bounded rate limiting, and a JavaScript-free login page using Collie's current
  design tokens and font behavior.
- Harden the reapplication for a single public origin: use a host-only session cookie, server-side
  session invalidation, exact same-origin checks, relative-only return targets, trusted-proxy client
  attribution, bounded credential inputs, strict proxy-header construction, parsed redirect
  rewriting, no-store responses, and network-first authentication for protected navigations.
- Make the Gateway the only public application boundary and proxy authenticated requests to the
  stock Collie v1.2.0 UI and APIs on loopback. Every public API requires a current Fleet session;
  only the explicit authentication flow and a minimal update-safe static asset allowlist are public.
- Retain upstream Tailscale serve and identity code for fork compatibility, but make the Fleet lead
  profile select external ingress and its own password/session boundary instead of relying on
  Tailscale identity.
- Add the first exact `FORK.toml` inventory, keeping Gateway/configuration behavior in owned roots and
  enumerating only the minimum upstream-owned identity, lifecycle, proxy, and service-worker ports.
- Provide generic, public-safe operator documentation for the configuration and reverse-proxy
  contract without checking in a live `fleet.toml`, deployment hostname, device mapping, or secret.

Non-goals for this change:

- SSH transport, Pack enrollment or routing, multi-host aggregation, peer-role runtime behavior,
  forward or reverse tunnel supervision, and center-driven peer updates.
- Fleet navigation/sidebar/shortcut reapplication, Settings reapplication, iframe migration, ttyd,
  Discord notifications, STT changes, deputy/failover, or any deployment-specific configuration.
- Removing or redesigning Collie's upstream Tailscale deployment option, Pack trust protocol,
  native UI, multiplexer adapters, or existing feature behavior.
- Cutting or tagging the public v3 release; staging remains pinned to reviewed `v3-dev` commits until
  the owner separately approves a release.

## Capabilities

### New Capabilities

- `fleet-plugin-runtime`: Defines the downstream plugin identity, Collie v1.2.0 provenance, owned
  lead/solo lifecycle, and minimum fork boundary.
- `fleet-runtime-configuration`: Defines the strict private `fleet.toml` lead/solo configuration,
  permissions, validation, and separation from live deployment and Collie-managed state.
- `fleet-public-authentication`: Defines the single-account login/session Gateway, public route
  boundary, authenticated Collie proxy, Caddy-compatible ingress contract, and security properties.

### Modified Capabilities

None. The source repository has no existing downstream product specifications, and unchanged Collie
capabilities are intentionally not restated here.

## Impact

- Affects the Herdr plugin manifest and downstream identity/provenance surfaces.
- Adds fork-owned runtime configuration, Gateway/authentication, session-state, proxy, login UI, and
  minimal supervisor integration modules, reusing reviewed v2 behavior where it remains applicable.
- Adds focused tests for configuration permissions, credential/session handling, route gating,
  Host/Origin/redirect/header/cookie/cache boundaries, and the single loopback upstream.
- Adds `FORK.toml`, its boundary validation, and public-safe configuration/ingress documentation.
- Does not add a network dependency or authentication service: Bun's existing password and crypto
  primitives remain sufficient.
- Produces a single-host candidate suitable for later deployment behind an operator-owned HTTPS
  reverse proxy; actual Caddy and deployment files remain outside the public source tree.
