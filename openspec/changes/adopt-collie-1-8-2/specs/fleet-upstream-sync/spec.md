## MODIFIED Requirements

### Requirement: A preflight proves the ground before the merge starts

An adoption SHALL run a preflight against the selected target before the merge begins, and the
preflight SHALL report, for that target: every invasive entry whose declared paths it disturbs, and
every path currently declared downstream-owned that the target now ships. A path the fork claims as
its own and upstream has begun to occupy is a collision of meaning that MUST be escalated to an
explicit decision before the merge, not discovered as a conflict during it.

A declared path that the target renames or moves is disturbed. The preflight SHALL count both the
path it left and the path it arrived at as changed, and SHALL report the destination beside the
declared path, so a port whose upstream file moved is reported on that path and the reviewer is told
where the port now has to live. This SHALL NOT depend on the operator's Git configuration for rename
detection: the same repository and target produce the same report on every machine.

The preflight SHALL refuse to start while the working tree carries uncommitted or untracked changes.
The boundary check classifies an untracked file as a downstream addition, so on a dirty tree its
report cannot distinguish the operator's work in progress from what the adoption brings; and once the
merge is open, the working tree is the conflict resolution itself.

The preflight SHALL list every active OpenSpec change. An active change SHALL NOT block the adoption
once the operator has authorized proceeding with it, and `--allow-active-changes` is how that
authorization is stated to the tooling. An agent MUST NOT pass that flag without the operator's
explicit authorization for this adoption; the tooling records the decision, it does not make it.

#### Scenario: A preflight runs against a target
- **WHEN** the preflight resolves a target release
- **THEN** it reports every invasive entry the target disturbs and every owned path the target now ships

#### Scenario: The target renames a declared path
- **WHEN** an invasive entry declares a path that the target moves to a new name
- **THEN** the entry is reported as disturbed on that declared path, and the report names the path it moved to

#### Scenario: Git rename detection is configured differently
- **WHEN** the preflight runs where Git's rename detection is enabled, disabled, or left at its default
- **THEN** the set of disturbed entries and their paths is the same in every case

#### Scenario: The target occupies a downstream-owned path
- **WHEN** the selected target ships a path declared under an `[[owned]]` entry
- **THEN** the preflight escalates it for an explicit decision and the adoption does not silently keep both meanings

#### Scenario: The working tree is dirty
- **WHEN** the preflight runs with uncommitted or untracked changes present
- **THEN** it refuses to start, and says that in-flight work must be committed first

#### Scenario: An OpenSpec change is open
- **WHEN** the preflight runs while a change is active
- **THEN** it lists that change, and proceeds only when the operator's authorization is stated, otherwise refusing

#### Scenario: Authorization is claimed without being given
- **WHEN** an agent states the authorization the operator did not give
- **THEN** that is a violation of this specification, which the tooling cannot detect and does not excuse
