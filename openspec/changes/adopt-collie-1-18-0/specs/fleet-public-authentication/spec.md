## ADDED Requirements

### Requirement: The Gateway is the Collie child's one paired device
The adopted Collie answers every `/api/*` route except its health and pair routes only to a request
carrying a paired device's bearer token, and refuses its own host credential on any request a proxy
forwarded. On a lead, Fleet SHALL therefore enrol the Gateway as a paired device of its own Collie
child, through Collie's own pairing module and in the Collie state directory Fleet validates, before
that child starts. The enrolment SHALL revoke any device previously enrolled under the Gateway's
label and enrol a fresh one, and SHALL refuse to start the generation when Collie reports a conflict
or cannot read its registry. The token SHALL be generated anew on every Fleet start, SHALL exist only
in the memory of the supervisor and the Gateway, and MUST NOT be written to disk, logged, placed in a
status answer or passed to any process other than the Gateway. Only its hash, as Collie stores every
device's, reaches the registry. A Collie child restarted within a running generation SHALL find the
same enrolment. A clean stop SHALL revoke it again.

The Gateway SHALL refuse a browser's attempt to pair or to revoke a device — `POST /api/pair` and
every device-revocation write — before it reaches Collie, with a refusal body of its own that is
neither of the two bodies upon which the web application wipes its stored state. A peer SHALL enrol
no device: no browser reaches a peer's Collie, and the crew link keeps its own two factors.

Enrolment SHALL need no action from the operator.

#### Scenario: A lead starts
- **WHEN** a lead generation starts with a readable Collie state directory
- **THEN** exactly one device carries the Gateway's label, enrolled with a token minted for this start, and every proxied request reaches Collie with that token

#### Scenario: A previous generation left its device behind
- **WHEN** the registry already holds a device under the Gateway's label
- **THEN** that device is revoked and a fresh one enrolled, so the previous token authenticates as nobody

#### Scenario: The registry cannot be read
- **WHEN** Collie's pairing registry is present but unreadable, or enrolment reports a conflict
- **THEN** the generation does not start and the diagnostic names the cause without printing a token

#### Scenario: The Collie child restarts on its own
- **WHEN** the supervisor restarts the Collie child without restarting Fleet
- **THEN** the registry still holds the Gateway's hash and proxied requests keep succeeding

#### Scenario: A browser tries to pair or revoke
- **WHEN** an authenticated browser sends `POST /api/pair` or a device-revocation write through the Gateway
- **THEN** the Gateway answers with its own refusal, Collie is not contacted, and the body is not one upon which the application wipes its stored state

#### Scenario: A peer starts
- **WHEN** a peer generation starts
- **THEN** no device is enrolled and the peer's federated answers over the crew link are unchanged

## MODIFIED Requirements

### Requirement: The authenticated proxy constructs a narrow trusted request
After session authorization, the Gateway SHALL proxy to exactly one configured loopback Collie
origin. It MUST preserve the method, normalized path, query, and bounded streaming body while
constructing upstream headers from an allowlist. It MUST remove the Fleet session, browser
authorization, hop-by-hop headers, client forwarding headers, Tailscale identity headers, and any
trusted device header before adding only the configured Host, Origin, proxy metadata Collie
requires, and the Gateway's own pairing bearer token. Requests the Gateway makes to Collie on its own
behalf SHALL carry the same token. Upstream response cookies MUST NOT overwrite the Fleet session,
and absolute redirects MUST be rewritten only after parsing and exact-origin comparison.

#### Scenario: An authenticated API is proxied
- **WHEN** a valid session requests a Collie API through the public origin
- **THEN** Collie receives the intended method, path, query, body, configured public security headers and the Gateway's pairing token, but receives no Fleet credential, no browser-supplied authorization and no client-forged trusted identity

#### Scenario: The Gateway reads Collie for itself
- **WHEN** the Gateway reads Collie's snapshot to resolve a terminal binding
- **THEN** the read carries the Gateway's pairing token and is answered

#### Scenario: Upstream attempts to set the Fleet cookie
- **WHEN** Collie returns a cookie whose name matches the Fleet session cookie
- **THEN** the Gateway removes that cookie while preserving separately allowlisted response cookies

#### Scenario: Upstream returns an absolute redirect
- **WHEN** Collie returns a Location value
- **THEN** the Gateway rewrites it only when its parsed origin exactly equals the configured loopback origin and otherwise refuses to create an external redirect from that value

### Requirement: Protected navigations and APIs cannot be recovered from stale browser caches
The service worker and HTTP cache policy MUST send authentication and protected navigations to the
network before any application-shell fallback, MUST never cache an API or authentication response,
and MUST prevent a previously authenticated document or pane response from satisfying a request
after logout or session expiry. Static update assets MAY remain available while signed out only when
they contain no protected data.

A navigation SHALL be answered from the precached application shell only when the network request
itself fails. Any HTTP answer — a document, a Gateway `401`, a redirect to login, an error — SHALL
be returned as the network gave it and SHALL NOT be stored by the worker. The shell carries no
protected data of its own, so an offline cold start can open the adopted Collie's read-only mode.

#### Scenario: A session expires in an installed PWA
- **WHEN** the client navigates after expiry while an older application shell and protected responses exist locally
- **THEN** the network authentication response controls the navigation and no cached document, API body, or pane content bypasses it

#### Scenario: Logout is followed by back navigation
- **WHEN** a client logs out and navigates through browser or service-worker history
- **THEN** protected content requires a new valid session and sensitive responses were not stored for reuse

#### Scenario: The device is offline at a cold start
- **WHEN** an installed client opens with no network
- **THEN** the precached application shell opens, and the application shows what the adopted Collie keeps for offline reading

#### Scenario: The network answers with a refusal
- **WHEN** a navigation reaches the Gateway and is answered with a `401`, a redirect or an error status
- **THEN** that answer is what the browser receives, and it is not cached
