## ADDED Requirements

### Requirement: Fleet resolves the multiplexer command one way on every machine
Every place Fleet runs the multiplexer's own `herdr` command — a peer's terminal service, the lead
Gateway's terminal attach, and the manual Pane fit controller on either side — SHALL obtain that
executable from one shared resolution, so that on one machine the attach and the fit always run the
same binary.

The resolution SHALL prefer the `HERDR_BIN_PATH` value of the environment the plugin was started with,
when it is set and names an absolute path to an executable regular file. Otherwise it SHALL fall back
to the first `herdr` on that environment's `PATH`, accepted only as an absolute path. When neither
yields an executable, it SHALL produce a diagnostic that names both sources and why each was not used,
and the caller SHALL report that diagnostic rather than a generic failure.

The executable MUST NOT be taken from Fleet configuration, a browser request, or a peer request.

#### Scenario: Herdr states its binary outside PATH
- **WHEN** the plugin environment sets `HERDR_BIN_PATH` to an executable and its `PATH` holds no `herdr`
- **THEN** the peer terminal service starts, and its attach and fit both run that executable

#### Scenario: The stated binary is unusable
- **WHEN** `HERDR_BIN_PATH` is set but is not absolute, does not exist, or is not executable, and `PATH` holds an executable `herdr`
- **THEN** the `PATH` executable is used

#### Scenario: No herdr can be found
- **WHEN** neither `HERDR_BIN_PATH` nor `PATH` yields an executable `herdr`
- **THEN** the peer terminal service refuses to start with a diagnostic naming both sources, and a lead Gateway offers neither terminals nor a local fit and logs the same diagnostic
