## Context

See `proposal.md` for motivation. The source branch starts at exact Collie v1.2.0 and currently has
no downstream product implementation. Upstream provides a loopback bridge, a PWA, Host/Origin gates,
Tailscale-oriented lifecycle, and a reserved `/auth/*` namespace, but it deliberately has no human
login or session model.

The previous Fleet line contains a useful owned implementation of Argon2id login, signed cookies,
safe returns, rate limiting, a reverse proxy, and a Herdr-coupled supervisor. It also contains
multi-domain cookies, iframe/public-host routing, node aggregation, SSH transports, and other behavior
that is now out of scope. Reapplication therefore means selecting and hardening the cohesive owned
parts, not copying the old Gateway tree wholesale.

The security review found several v2 assumptions that cannot survive the single-origin design:
cross-subdomain cookies are unnecessarily broad; safe returns compare hostnames instead of exact
origins; login POST lacks the same Origin check as logout; client rate keys trust forwarding headers;
stateless logout cannot revoke a copied token; and absolute redirect rewriting uses a string prefix.
The new boundary must address these before it is published.

## Goals / Non-Goals

**Goals:**

- Keep all downstream behavior in one cohesive `fleet/` owned root plus the minimum manifest, build,
  lifecycle, and service-worker ports.
- Reapply the proven v2 authentication semantics while closing the reviewed single-origin security
  gaps.
- Run stock Collie behind one loopback-only Fleet Gateway without requiring a second product UI or
  changing Collie's API behavior.
- Establish a strict private configuration and fork manifest that later changes can extend without
  moving the first-stage boundary.
- Produce small, independently reviewable and pushable commits, each passing focused verification.

**Non-Goals:**

- Implementing any peer, Pack, SSH, transport retry, host aggregation, Fleet sidebar/shortcut,
  Settings, ttyd, notification, or failover behavior.
- Making the public repository own a live configuration or deployment topology.
- Removing upstream Tailscale code or changing Pack authentication.
- Cutting a v3 release or preserving v2's cross-domain/iframe compatibility.

## Decisions

### 1. Use one explicit fork-owned `fleet/` root

Configuration, authentication, active-session state, login markup/styles, proxy policy, Gateway
request handling, and supervisor state will live under `fleet/`. Tests sit beside the owned modules.
Small upstream edits may invoke the owned entrypoint, include the root in typechecking/building,
preserve network-first authentication, and expose the new plugin identity; they will not contain
Gateway business logic.

This is preferred to restoring separate `gateway/`, `supervisor/`, and browser-Fleet trees because
the first stage is one cohesive boundary and no multi-host UI exists yet. It also makes a future
split deliberate rather than recreating v2's historical scattering.

### 2. Make `fleet.toml` the only Fleet runtime configuration

The runtime resolves `<plugin-config-dir>/fleet.toml`, with an explicit absolute-path override for
tests and operator tooling. Bun's built-in TOML parser avoids a new dependency. Parsing is strict and
produces an immutable discriminated configuration; every table rejects unknown keys.

Schema version 1 accepts only `role = "lead"`, one public HTTPS origin, one loopback Gateway listener,
one loopback Collie upstream, the account/hash/signing-secret/session policy, and bounded trusted-
proxy/rate-limit settings. It deliberately rejects `peer`, `hosts`, `transport`, `ssh`, and `pack`.
Those names remain available for a later schema revision, but no dormant implementation ships now.

The loader checks POSIX owner-only file permissions before reading and never logs values from secret
fields. No real or complete configuration is committed; tests construct synthetic fixtures in
private temporary directories. Collie's `.env`, `pack-trust.json`, and `pack-ops.json` keep their
upstream meanings and are not folded into this file.

Alternatives rejected:

- Extending Collie's `.env`: mixes the fork's security authority into an upstream configuration
  surface and makes role validation weak.
- Treating Pack trust JSON as configuration: makes operator topology capable of overwriting keys,
  pins, or the Pack secret.
- Reusing the v2 JSON file byte-for-byte: preserves obsolete multi-domain and multi-node fields and
  conflicts with the selected native-style TOML configuration direction.

### 3. Reapply authentication as a thin same-origin Gateway

The Gateway is the public application boundary. It serves `/auth/login`, `/auth/logout`, the login
stylesheet, and an exact update-safe static allowlist; it requires a Fleet session before every API
or application document and then proxies to one configured loopback Collie. It does not aggregate,
render a Fleet shell, select a host, or frame another page.

The login page remains server-rendered and works without JavaScript. Its CSS reuses Collie v1.2.0's
font families, color tokens, radii, spacing, focus treatment, and light/dark behavior rather than
copying v2's visual constants blindly. The stock Collie PWA is the only authenticated application UI.

An external off-the-shelf identity proxy was rejected for this phase because the selected product
contract is the existing Fleet single-account flow and its configuration/lifecycle must travel with
the plugin. Embedding username/password logic inside Collie's bridge was rejected because the
reserved `/auth/*` seam and an owned fronting Gateway provide a narrower fork boundary.

### 4. Keep signed cookies but add server-recognized session state

A login creates a random 256-bit session id and a signed versioned token containing only the session
id and bounded issuance/expiry claims. The cookie uses a `__Host-` name, `Secure`, `HttpOnly`,
`SameSite=Strict`, and `Path=/`, with no Domain attribute.

The Gateway persists only a one-way digest of active session ids plus their issuance, last-use, and
absolute-expiry facts in an owner-only, atomically replaced state file. A request must pass both the
HMAC/time validation and the active-record lookup. Logout deletes the current record before clearing
the cookie, so a copied token is no longer accepted. Expired records are pruned on bounded reads and
writes. A missing or unreadable state file fails closed for existing cookies; it never regenerates a
credential or accepts token-only state.

The stateful check costs a small local read/cache and file write on login/logout, but closes the main
security gap in v2's stateless logout. A fully opaque cookie was considered; retaining the signature
allows malformed/tampered tokens to be rejected before state lookup and preserves the reviewed v2
contract. Sliding renewal is deferred: the configured absolute lifetime remains simple and testable.

### 5. Treat login transitions as exact-origin operations

Both login and logout require POST plus exact configured Origin, falling back to an exact parsed
Referer only when Origin is absent. Safe return values are stored as normalized paths beginning with
one `/`; values beginning with `//`, containing authority/userinfo/control/backslash ambiguity, or
resolving outside the application origin fall back to `/`. No absolute user-provided destination is
ever emitted.

All form and credential lengths are checked before Argon2 work. Validly shaped failures run the same
password verification and return the same message/status regardless of which credential was wrong.
The configured Argon2id parameters remain at least the reviewed v2 strength.

### 6. Use two bounded login budgets and a trusted ingress contract

The listener supplies the actual socket peer to the handler. Forwarded client attribution is used
only when the socket peer is loopback and the configuration says one reverse-proxy hop is trusted;
the public proxy contract requires replacing, not appending, the client-address header. The limiter
combines a finite per-source table with a finite aggregate attempt budget, monotonic retry windows,
and bounded exponential recovery. This prevents source rotation from turning Argon2 into an
unbounded CPU/memory service while avoiding a permanent single-account lockout.

The old IP-only map was rejected because spoofed or highly distributed source values could evict the
relevant entry. CAPTCHA and an external database were rejected as unnecessary dependencies for a
single-operator service.

### 7. Build proxy headers and redirects from parsed allowlists

The proxy copies only request headers Collie's browser API needs, including content negotiation,
conditional reads, ranges, content type, and the public Origin. It removes hop-by-hop fields,
authorization, the Fleet cookie, forwarding metadata, Tailscale identity, and device-trust headers,
then writes the configured public Host/Origin and trusted proxy facts itself. Request targets are
formed from a parsed loopback origin plus the already-parsed path/query; user input can never choose
an upstream authority.

Response cookies matching the Fleet session name are removed. An absolute Location is rewritten only
when its parsed origin exactly equals the configured Collie origin; relative redirects remain
relative, and every other absolute origin is rejected rather than string-rewritten. Protected and
authentication responses use `no-store`; hop-by-hop and stale encoding/length headers are removed.

### 8. Preserve Collie's browser-cache boundary

The upstream service worker already has a network-first exclusion for authentication routes. The
fork will keep that behavior and add only the minimum assertion needed to ensure all document
navigations reach the Gateway before an app-shell fallback. API and authentication responses never
enter a runtime or precache path. Public static assets are restricted to known PWA update resources
and validated immutable assets; source maps and arbitrary files do not inherit an asset-prefix
exception.

### 9. Select, do not delete, the upstream Tailscale alternative

The Fleet launcher derives a sanitized Collie child environment that forces loopback, supplies the
single public Host/Origin, and selects `COLLIE_SKIP_SERVE=1`. It removes conflicting inherited
Tailscale identity/publication values rather than letting two authentication systems appear active.
The upstream Tailscale CLI, checks, documentation, and Pack code remain present for mergeability and
standalone Collie behavior.

### 10. Commit in independently reviewable stages

Planning is committed separately. Apply then uses at least these normal, non-force `v3-dev` commits:

1. downstream identity, `FORK.toml`, and private lead configuration;
2. signed/revocable authentication core and login UI;
3. authenticated single-upstream proxy and plugin lifecycle;
4. security/cache hardening, focused tests, and public documentation;
5. OpenSpec sync/archive after all verification passes.

If a stage cannot build independently, it is folded into the immediately preceding dependency rather
than pushed broken. No commit contains a live configuration or deployment value.

## Risks / Trade-offs

- **[Stateful sessions add a local state file]** -> Keep it owner-only, atomic, versioned, bounded,
  and outside configuration; fail closed without it.
- **[A public static asset can reveal application code]** -> Publish only resources needed to update
  an installed PWA; code is already public, while documents and data remain authenticated.
- **[A trusted forwarding header can be spoofed by a local process]** -> Bind Gateway to loopback,
  require the proxy to replace the header, retain an aggregate limiter, and treat a same-user local
  process as already inside the host boundary.
- **[Forcing the Collie child environment can surprise an operator expecting Tailscale]** -> Make the
  Fleet profile and status explicit, reject conflicting Fleet configuration, and retain standalone
  upstream behavior outside that profile.
- **[Reapplying a v2 module can carry obsolete coupling]** -> Move only behavior covered by the new
  specs, use the new `fleet/` ownership boundary, and reject node/iframe/SSH imports mechanically.
- **[A lifecycle rewrite can disturb unrelated processes]** -> Use a private generation-qualified
  control socket and only the daemon's direct child handles; never kill from pid files, ports, or
  broad process-name matching.
- **[Release version remains upstream-derived during development]** -> Identify every staging build
  by exact commit; change versions and tags only in a separately authorized release operation.

## Migration Plan

1. Land and push the planning commit without changing runtime behavior.
2. Land the identity/configuration boundary and verify the stock Collie build remains reproducible.
3. Land authentication, proxy, and lifecycle commits with focused tests after each stage.
4. Build a complete candidate, run root and web typechecks/tests/build, strict OpenSpec validation,
   the fork audit, and a tracked-tree privacy scan.
5. Push the exact candidate before any deployment consumes it.
6. On an operator-selected staging system, create the private configuration outside the source tree,
   start the candidate on separate loopback ports, and route a separate HTTPS origin to its Gateway.
7. Verify login/logout/revocation/expiry/rate limits, Host/Origin/return/header/cache negatives, every
   API's unauthenticated refusal, and the absence of a public raw Collie port.
8. Keep the previous service untouched throughout validation. Roll back by removing only the staging
   proxy route and stopping only the candidate generation.
9. Stop for owner acceptance before proposing any UI or multi-host reapplication.
