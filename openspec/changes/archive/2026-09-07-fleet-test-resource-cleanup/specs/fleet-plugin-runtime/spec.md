## ADDED Requirements

### Requirement: Fork-owned tests remove the temporary directories they create
A fork-owned test under `fleet/` that calls `mkdtemp` SHALL remove the
directory it created before the test process exits, including when an
assertion fails. The cleanup mechanism SHALL be local to the test file:
either a `bun:test` `afterAll` or `afterEach` that drains a module-local
collection of paths with `rm(path, { recursive: true, force: true })`, or
a per-test `try { … } finally { await rm(dir, …); }` block. The mechanism
chosen SHALL match the closest sibling pattern already used in the fork,
so an existing test file's `try/finally` continues to use `try/finally`
and an existing array + lifecycle-hook pattern continues to use that
shape. No shared cross-file fixture helper SHALL be introduced for this
rule.

A fork-owned test SHALL NOT remove directories it did not create. The
test process SHALL NOT sweep the system `tmpdir()` by prefix, SHALL NOT
delete directories left by a different test file, and SHALL NOT delete
directories left by an in-flight or running deployment.

#### Scenario: A passing fork-owned test removes its temporary directory
- **WHEN** a fork-owned test under `fleet/` runs to completion in `bun test`
  and the test body has called `mkdtemp`
- **THEN** the directory created by `mkdtemp` no longer exists in the
  system `tmpdir()` after the test process exits

#### Scenario: A failing fork-owned test still removes its temporary directory
- **WHEN** a fork-owned test under `fleet/` runs an assertion that rejects
  or throws after `mkdtemp` has resolved
- **THEN** the directory created by `mkdtemp` no longer exists in the
  system `tmpdir()` after the test process exits, because the lifecycle
  hook or `finally` block ran on the failure path

#### Scenario: A new fork-owned test follows the established pattern
- **WHEN** a new fork-owned test under `fleet/` is added that needs a
  temporary directory
- **THEN** the test removes the directory it creates using whichever local
  mechanism its file already uses, and never relies on the operating
  system or the operator to clean up after it
