## ADDED Requirements

### Requirement: A Fleet checkout writes no agent skill on its own
The adopted Collie's update, rollback and release-line switch run `collie skill sync` after a
successful swap, which writes the walky talky skill into every agent harness found on the machine.
In a Herdr Fleet checkout that step SHALL be off unless the operator turns `COLLIE_SKILL_SYNC` on
explicitly: an update, a rollback or a switch reached from any path — the Herdr plugin, the phone's
Updates page, a crew member following its lead, or the CLI — SHALL write no file under any harness's
configuration, and SHALL print upstream's one note instead when the skill is behind. Fleet SHALL NOT
install the skill by any other path. `collie skill install` and `collie skill sync`, run by hand,
remain the operator's own acts and SHALL behave as upstream ships them.

The decision SHALL live in a fork-owned module, and the upstream updater SHALL consult it through one
narrow port. It SHALL be read from the checkout itself rather than only from the environment, because
the phone's update may run in a transient unit that inherits no environment.

#### Scenario: An update completes in a Fleet checkout
- **WHEN** an update, a rollback or a release-line switch succeeds in a Herdr Fleet checkout and `COLLIE_SKILL_SYNC` is unset
- **THEN** `collie skill sync` does not run, no harness file is written, and at most upstream's one note says the skill is behind

#### Scenario: The operator turns the sync on
- **WHEN** `COLLIE_SKILL_SYNC` is set to an on-word for that update
- **THEN** the sync runs exactly as upstream ships it

#### Scenario: The update runs in a transient unit
- **WHEN** the phone's Update or Roll back starts `collie update` in a transient unit with a bare environment
- **THEN** the sync is still off, because the checkout says it is Herdr Fleet

#### Scenario: A checkout that is not Herdr Fleet
- **WHEN** the same updater runs in a checkout whose plugin manifest is not Herdr Fleet's
- **THEN** upstream's default holds, unchanged
