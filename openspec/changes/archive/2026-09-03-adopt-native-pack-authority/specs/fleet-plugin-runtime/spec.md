## MODIFIED Requirements

### Requirement: Herdr owns the role-aware Fleet runtime lifecycle
The plugin SHALL run the exact child composition selected by its validated Fleet configuration and
native Pack authority state without requiring Collie's Tailscale publication or a separately
installed operating-system service.

A schema-1 Lead SHALL continue to run one loopback Collie child and one loopback authenticated
Gateway child with unchanged inputs. A schema-2 Lead SHALL run the same two child kinds after native
Lead authority validation. A schema-2 Peer SHALL run one local loopback Collie child and MUST NOT
start a Gateway, Fleet session store, browser-authentication listener, or public listener.

Start, stop, restart, status, and failed-start cleanup MUST act only on the plugin-owned generation,
MUST report the configured role and exact child set without secrets, and MUST leave unrelated Herdr
state and terminal panes unchanged.

#### Scenario: Existing schema-1 Lead starts
- **WHEN** Herdr starts the plugin with an unchanged valid schema-1 Lead configuration
- **THEN** one loopback Gateway and one loopback Collie child become ready with the same observable configuration and status as before this change

#### Scenario: Schema-2 Lead starts
- **WHEN** Herdr starts a schema-2 Lead whose configuration and native Pack authority state agree
- **THEN** one loopback Gateway and one loopback Collie child become ready and status identifies the Lead role without exposing trust or browser secrets

#### Scenario: Schema-2 Peer starts
- **WHEN** Herdr starts a schema-2 Peer whose configuration and native Pack authority state agree
- **THEN** one loopback Collie child becomes ready, no Gateway or browser listener exists, and status identifies the Peer role

#### Scenario: Startup fails after a child was created
- **WHEN** a required child cannot become ready or configuration/authority validation fails
- **THEN** the attempted generation is cleaned up, no unintended listener is created, and unrelated Herdr processes and panes remain untouched
