## MODIFIED Requirements

### Requirement: Every public application API is session authenticated
The Gateway SHALL be the only publicly reachable application listener. Every public `/api/*` request,
every application document navigation, and every protocol-upgrade request MUST require a current
Fleet session before contacting Collie or any terminal server. Unauthenticated API requests SHALL
receive a machine-readable `401`; unauthenticated navigations SHALL enter the login flow; an
unauthenticated upgrade SHALL be refused before the upgrade completes, rather than being accepted and
closed afterwards. Only the explicit authentication endpoints and an exact, minimal allowlist of
immutable or update-critical static assets MAY be read without a session, and no unauthenticated route
may expose a Collie snapshot, pane, terminal, configuration, history, or mutation.

An upgrade request SHALL additionally be refused unless its Host is the configured public Host and its
declared origin is the configured public origin, because an upgrade is not subject to the browser's
own cross-origin request rules. A session that expires or is revoked while an upgraded connection is
established SHALL cause that connection to be closed.

#### Scenario: An unauthenticated API is requested
- **WHEN** any public path under `/api/` is requested without a current Fleet session
- **THEN** the Gateway returns `401` without contacting Collie

#### Scenario: An unauthenticated document is requested
- **WHEN** an application navigation other than the login flow lacks a current Fleet session
- **THEN** the Gateway redirects to login with only a validated internal return path

#### Scenario: An unauthenticated upgrade is requested
- **WHEN** a protocol-upgrade request lacks a current Fleet session
- **THEN** the Gateway refuses before the upgrade completes and contacts no Collie or terminal server

#### Scenario: A cross-origin upgrade is requested
- **WHEN** an upgrade request carries a current Fleet session but declares an origin or Host other than the configured public one
- **THEN** the Gateway refuses it

#### Scenario: A session ends during an upgraded connection
- **WHEN** the session behind an established upgraded connection expires or is revoked
- **THEN** that connection is closed

#### Scenario: An allowlisted static asset is requested
- **WHEN** an unauthenticated client requests one exact update-safe asset path or a validated immutable asset path
- **THEN** the Gateway serves only that asset and does not generalize the exception to HTML, API, Pack, upgrade, source-map, or filesystem paths
