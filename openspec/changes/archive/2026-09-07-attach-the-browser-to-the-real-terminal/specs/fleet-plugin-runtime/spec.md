## MODIFIED Requirements

### Requirement: Herdr owns the role-aware Fleet runtime lifecycle
The plugin SHALL run the exact child composition selected by its validated Fleet configuration and
native Pack authority state without requiring Collie's Tailscale publication or a separately
installed operating-system service.

A schema-1 Lead SHALL continue to run one loopback Collie child and one loopback authenticated
Gateway child with unchanged inputs. A schema-2 Lead SHALL run the same two child kinds after native
Lead authority validation and after its reachability mapping is validated against native membership.
A schema-2 Peer SHALL run one local loopback Collie child plus one supervised reachability link child,
and MUST NOT start a Gateway, Fleet session store, browser-authentication listener, or public listener.

A schema-2 Peer whose validated configuration declares a terminal endpoint SHALL additionally run one
supervised terminal-service child, bound to that endpoint and reachable only through the link's
terminal projection. That child SHALL be started with the Peer's own sanitized child environment and
MUST NOT receive the Fleet configuration path, session state, or any browser-authentication material.
A Peer whose configuration declares no terminal endpoint SHALL run the same two children it ran before
this change and MUST NOT start a terminal-service child. The terminal-service child SHALL be permitted
to stand itself down while idle without that being reported as a failure, and a later request SHALL
bring it back under the same supervision.

Start, stop, restart, status, and failed-start cleanup MUST act only on the plugin-owned generation,
MUST report the configured role and exact child set without secrets, and MUST leave unrelated Herdr
state and terminal panes unchanged. A link child that exits MUST be recovered under its own bounded
backoff without restarting the Collie child, a terminal-service child that exits unexpectedly MUST be
recovered without restarting the Collie or link child, and stopping the plugin MUST leave no orphaned
link process, terminal server, published projection, or terminal endpoint.

#### Scenario: Existing schema-1 Lead starts
- **WHEN** Herdr starts the plugin with an unchanged valid schema-1 Lead configuration
- **THEN** one loopback Gateway and one loopback Collie child become ready with the same observable configuration and status as before this change

#### Scenario: Schema-2 Lead starts
- **WHEN** Herdr starts a schema-2 Lead whose configuration, native Pack authority state, and reachability mapping agree
- **THEN** one loopback Gateway and one loopback Collie child become ready and status identifies the Lead role without exposing trust or browser secrets

#### Scenario: Schema-2 Peer starts
- **WHEN** Herdr starts a schema-2 Peer whose configuration and native Pack authority state agree and whose configuration declares no terminal endpoint
- **THEN** one loopback Collie child and one reachability link child become ready, no Gateway, browser listener, or terminal service exists, and status identifies the Peer role and the link layer separately

#### Scenario: Schema-2 Peer with a terminal endpoint starts
- **WHEN** Herdr starts a schema-2 Peer whose validated configuration declares a terminal endpoint
- **THEN** one loopback Collie child, one reachability link child, and one terminal-service child become ready, the terminal service holds no terminal server, no Gateway or browser listener exists, and status reports the terminal layer separately from the link

#### Scenario: The link child exits while Collie is healthy
- **WHEN** a schema-2 Peer's link child exits
- **THEN** only the link child is retried under bounded backoff, the Collie child keeps running, and status reports the Peer as not ready until the link is re-established

#### Scenario: The terminal service stands down while idle
- **WHEN** a Peer's terminal-service child stands itself down after its idle interval
- **THEN** status reports it as idle rather than failed, the Collie and link children are untouched, and a later terminal request brings the service back under the same supervision

#### Scenario: Startup fails after a child was created
- **WHEN** a required child cannot become ready or configuration/authority/reachability validation fails
- **THEN** the attempted generation is cleaned up, no unintended listener, terminal server, or published projection is left behind, and unrelated Herdr processes and panes remain untouched
