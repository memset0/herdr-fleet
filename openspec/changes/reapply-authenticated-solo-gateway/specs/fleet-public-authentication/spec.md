## Purpose

Defines the single-account password and session boundary that permits one Collie lead to be exposed
through an operator-owned HTTPS reverse proxy without relying on Tailscale identity.

## ADDED Requirements

### Requirement: The Gateway authenticates exactly one configured account
The lead Gateway SHALL support exactly one configured username and Argon2id password hash, with no
registration, password recovery, user database, tenant model, RBAC, or per-user host isolation. It
MUST validate bounded username and password inputs, perform the password verification work for every
well-formed credential attempt, return one generic failure for an incorrect username or password,
and never log either submitted credential.

#### Scenario: Correct credentials are submitted
- **WHEN** the configured username and password are submitted in a bounded same-origin login request
- **THEN** the Gateway verifies the Argon2id hash, creates a new authenticated session, and redirects to the validated internal return path

#### Scenario: Either credential is incorrect
- **WHEN** a well-formed login attempt has an incorrect username, password, or both
- **THEN** the Gateway returns the same generic response and externally equivalent verification path without revealing which value differed

#### Scenario: Credential input is oversized or malformed
- **WHEN** a login request exceeds the request, username, or password bound or uses an unsupported content type
- **THEN** the Gateway rejects it before expensive verification without reflecting the submitted values

### Requirement: Login attempts are bounded using trusted request identity
The Gateway SHALL accept client-address attribution only from the configured loopback reverse proxy
and SHALL ignore or replace client-provided forwarding headers. Authentication failures MUST consume
bounded per-source and aggregate attempt budgets with finite memory, delayed recovery, and sanitized
diagnostics. Successful authentication MAY clear that source's failures but MUST NOT let one source
reset another source's budget.

#### Scenario: A client forges forwarding headers
- **WHEN** a public login request supplies its own `Forwarded`, `X-Forwarded-For`, or `X-Real-IP` values
- **THEN** rate limiting uses only the address attribution established by the trusted ingress contract

#### Scenario: Repeated failures exceed a budget
- **WHEN** login failures cross the configured per-source or aggregate threshold
- **THEN** further attempts receive one bounded retry response without running password verification until that budget recovers

#### Scenario: Many source keys are presented
- **WHEN** requests attempt to create more limiter entries than the configured bound
- **THEN** memory remains bounded and eviction cannot immediately remove the aggregate protection

### Requirement: Sessions are signed, server-recognized, expiring, and revocable
Each successful login SHALL issue a fresh cryptographically random session identifier in a
time-bounded signed token. The Gateway MUST also recognize the session as active in owner-only local
state, validate its signature and time claims on every protected request, enforce expiration on the
server, and revoke the current session on logout. Missing state, secret rotation, malformed claims,
future issuance outside a small clock allowance, expiry, or revocation MUST fail closed.

The session cookie MUST use a `__Host-` name with `Secure`, `HttpOnly`, `SameSite=Strict`, and
`Path=/`; it MUST omit `Domain`. Authentication responses and responses containing session state MUST
use `Cache-Control: no-store`.

#### Scenario: A fresh session is used
- **WHEN** a client presents the newly issued cookie before its server-enforced expiry and its active session record exists
- **THEN** the Gateway accepts the session without exposing the token to Collie or browser JavaScript

#### Scenario: Logout completes
- **WHEN** an authenticated client submits a same-origin logout request
- **THEN** the Gateway revokes that session server-side, clears the host-only cookie, and rejects a copied form of the old token on the next request

#### Scenario: A session is invalid or expired
- **WHEN** a token is missing, malformed, tampered, revoked, issued unacceptably in the future, absent from active state, or expired
- **THEN** every protected API and navigation treats the client as unauthenticated without revealing the failing token component

### Requirement: Authentication transitions are same-origin and return only within the application
Login and logout MUST use state-changing methods and exact configured-origin validation. The login
return value SHALL be represented and accepted only as a normalized application-absolute path; it
MUST reject an authority, alternate scheme, alternate port, user information, encoded authority,
backslash ambiguity, control character, or path outside the application origin. Invalid input SHALL
fall back to `/`. Login HTML SHALL retain enough same-origin referrer information for a browser that
omits the `Origin` header to submit the form with an exact-origin `Referer`, while requests to another
origin MUST receive no referrer information from that policy.

#### Scenario: A valid deep link is requested
- **WHEN** an unauthenticated navigation targets a normalized path and query within the public application origin
- **THEN** successful login returns to the same internal path without converting it into a user-controlled external URL

#### Scenario: A crafted return target is supplied
- **WHEN** login receives an absolute, scheme-relative, alternate-port, credential-bearing, malformed, or cross-origin target
- **THEN** the Gateway ignores it and returns to `/`

#### Scenario: A cross-origin form submits login or logout
- **WHEN** the request Origin or fallback Referer does not exactly match the configured public origin
- **THEN** the Gateway rejects the transition and neither creates nor revokes a session

#### Scenario: A browser omits Origin on the login form
- **WHEN** a browser submits the served login form without an Origin header
- **THEN** its same-origin Referer supplies the existing exact-origin evidence and the Gateway does not reject a correct login as forbidden

### Requirement: Every public application API is session authenticated
The Gateway SHALL be the only publicly reachable application listener. Every public `/api/*` request
and every application document navigation MUST require a current Fleet session before contacting
Collie. Unauthenticated API requests SHALL receive a machine-readable `401`; unauthenticated
navigations SHALL enter the login flow. Only the explicit authentication endpoints and an exact,
minimal allowlist of immutable or update-critical static assets MAY be read without a session, and
no unauthenticated route may expose a Collie snapshot, pane, configuration, history, or mutation.

#### Scenario: An unauthenticated API is requested
- **WHEN** any public path under `/api/` is requested without a current Fleet session
- **THEN** the Gateway returns `401` without contacting Collie

#### Scenario: An unauthenticated document is requested
- **WHEN** an application navigation other than the login flow lacks a current Fleet session
- **THEN** the Gateway redirects to login with only a validated internal return path

#### Scenario: An allowlisted static asset is requested
- **WHEN** an unauthenticated client requests one exact update-safe asset path or a validated immutable asset path
- **THEN** the Gateway serves only that asset and does not generalize the exception to HTML, API, Pack, source-map, or filesystem paths

### Requirement: Protected navigations and APIs cannot be recovered from stale browser caches
The service worker and HTTP cache policy MUST send authentication and protected navigations to the
network before any application-shell fallback, MUST never cache an API or authentication response,
and MUST prevent a previously authenticated document or pane response from satisfying a request
after logout or session expiry. Static update assets MAY remain available while signed out only when
they contain no protected data.

#### Scenario: A session expires in an installed PWA
- **WHEN** the client navigates after expiry while an older application shell and protected responses exist locally
- **THEN** the network authentication response controls the navigation and no cached document, API body, or pane content bypasses it

#### Scenario: Logout is followed by back navigation
- **WHEN** a client logs out and navigates through browser or service-worker history
- **THEN** protected content requires a new valid session and sensitive responses were not stored for reuse

### Requirement: The authenticated proxy constructs a narrow trusted request
After session authorization, the Gateway SHALL proxy to exactly one configured loopback Collie
origin. It MUST preserve the method, normalized path, query, and bounded streaming body while
constructing upstream headers from an allowlist. It MUST remove the Fleet session, browser
authorization, hop-by-hop headers, client forwarding headers, Tailscale identity headers, and any
trusted device header before adding only the configured Host, Origin, and proxy metadata Collie
requires. Upstream response cookies MUST NOT overwrite the Fleet session, and absolute redirects
MUST be rewritten only after parsing and exact-origin comparison.

#### Scenario: An authenticated API is proxied
- **WHEN** a valid session requests a Collie API through the public origin
- **THEN** Collie receives the intended method, path, query, body, and configured public security headers but receives no Fleet credential or client-forged trusted identity

#### Scenario: Upstream attempts to set the Fleet cookie
- **WHEN** Collie returns a cookie whose name matches the Fleet session cookie
- **THEN** the Gateway removes that cookie while preserving separately allowlisted response cookies

#### Scenario: Upstream returns an absolute redirect
- **WHEN** Collie returns a Location value
- **THEN** the Gateway rewrites it only when its parsed origin exactly equals the configured loopback origin and otherwise refuses to create an external redirect from that value

### Requirement: The reverse-proxy boundary fails closed
The Gateway and Collie SHALL bind only to configured loopback addresses. The public HTTPS proxy MUST
target the Gateway rather than Collie, preserve or set the exact configured public Host, replace
client attribution headers, and expose no raw application port. The Gateway SHALL emit strict CSP,
content-type, frame, referrer, permission, and transport-security headers appropriate to each login,
document, API, and static response.

#### Scenario: A request uses an unknown Host or Origin
- **WHEN** a request reaches the Gateway with a Host outside the single configured origin or an unsafe method carries a different Origin
- **THEN** the Gateway fails before session or upstream processing and reveals no deployment inventory

#### Scenario: A loopback port is probed externally
- **WHEN** an external client attempts to reach either the Gateway or Collie listener without the public HTTPS proxy
- **THEN** no network route exposes that listener

#### Scenario: Tailscale identity is absent
- **WHEN** the Fleet lead operates with external ingress and no Tailscale identity header
- **THEN** its own password/session gate remains authoritative and Collie does not publish or depend on a Tailscale serve mapping
