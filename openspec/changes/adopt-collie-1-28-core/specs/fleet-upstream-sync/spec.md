## MODIFIED Requirements

### Requirement: An adoption names one exact upstream release

An adoption SHALL target one upstream release tag and the commit that tag dereferences to. It MUST
NOT target a branch, a commit selected because it looked current, or any commit after the tag —
upstream's default branch moves, and a fork that adopts a moving reference can never say afterwards
what it is a fork of.

The commit recorded in `FORK.toml` SHALL normally be the merge base of the current tree and the selected target. A disagreement MUST stop the adoption by default. An explicitly authorized release-line reconciliation MAY proceed only when the recorded adopted commit is an ancestor of the current tree, both releases share a verified earlier upstream ancestor, and an audit records that ancestor, both release identities, every upstream-only change on the adopted release line, and its disposition in the target. Preflight SHALL require an explicit acknowledgement bound to the exact recorded release, target and merge base; an acknowledgement for another tuple MUST fail. It MUST NOT silently change the recorded baseline, rewrite history, flatten the adoption, or treat an unrelated history as a release-line reconciliation.

Once accepted, the adopted tag and its dereferenced commit SHALL be recorded in `FORK.toml`, and
`UPSTREAM.md` SHALL gain one row stating which release of this product corresponds to that Collie
release. Adopting a release SHALL NOT move this product's own version.

#### Scenario: A release is selected
- **WHEN** an adoption resolves its target
- **THEN** it resolves the tag object and the commit that tag dereferences to, and works from that commit alone

#### Scenario: The target is a branch or a later commit
- **WHEN** the target names a branch, or a commit that is not what the selected tag dereferences to
- **THEN** the adoption stops before any merge, manifest edit, or provenance change

#### Scenario: The recorded baseline is not the merge base
- **WHEN** the commit recorded in `FORK.toml` is not the merge base of the current tree and the target
- **THEN** the adoption stops and reports the disagreement unless the exact release-line reconciliation has been explicitly authorized and audited

#### Scenario: An adoption is accepted
- **WHEN** the adopted release is recorded
- **THEN** `FORK.toml` names the new tag and commit, `UPSTREAM.md` gains one correspondence row, and this product's version is unchanged

#### Scenario: Upstream maintained parallel release lines
- **WHEN** an explicitly authorized audit proves the recorded adoption is in the current tree and records the exact earlier common ancestor and the disposition of every adopted-line change
- **THEN** preflight reports both release identities and that ancestor, preserves the recorded provenance, and permits only the acknowledged exact target

#### Scenario: A reconciliation acknowledgement is stale or unrelated
- **WHEN** its recorded release, target or common ancestor differs, or the recorded adoption is not in the current tree
- **THEN** preflight refuses before merge and leaves provenance untouched
