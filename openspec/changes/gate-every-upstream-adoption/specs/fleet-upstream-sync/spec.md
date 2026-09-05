## Purpose

Governs how this fork adopts a newer Collie release: which release is chosen, what must be proven
before the merge starts, how every invasive port is reviewed against it, what shape the merge takes,
and how Collie's own release history is retained once upstream stops keeping all of it.

## ADDED Requirements

### Requirement: An adoption names one exact upstream release

An adoption SHALL target one upstream release tag and the commit that tag dereferences to. It MUST
NOT target a branch, a commit selected because it looked current, or any commit after the tag —
upstream's default branch moves, and a fork that adopts a moving reference can never say afterwards
what it is a fork of.

The commit recorded in `FORK.toml` SHALL be the merge base of the current tree and the selected
target. When it is not, the recorded baseline is not the ancestor it claims to be, and the adoption
MUST stop rather than proceed on a manifest that describes a history the repository does not have.

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
- **THEN** the adoption stops and reports the disagreement rather than merging against an unrelated baseline

#### Scenario: An adoption is accepted
- **WHEN** the adopted release is recorded
- **THEN** `FORK.toml` names the new tag and commit, `UPSTREAM.md` gains one correspondence row, and this product's version is unchanged

### Requirement: A preflight proves the ground before the merge starts

An adoption SHALL run a preflight against the selected target before the merge begins, and the
preflight SHALL report, for that target: every invasive entry whose declared paths it disturbs, and
every path currently declared downstream-owned that the target now ships. A path the fork claims as
its own and upstream has begun to occupy is a collision of meaning that MUST be escalated to an
explicit decision before the merge, not discovered as a conflict during it.

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

### Requirement: Every invasive entry is reviewed against the adopted release

Each `[[invasive]]` entry in `FORK.toml` SHALL record the upstream release it was last reviewed
against. The boundary check SHALL fail while any entry records a release older than the one currently
adopted, so an adoption cannot be completed with an entry nobody looked at.

An entry SHALL be advanced only after it has received one explicit decision — keep it, adapt it,
replace it from upstream, or drop it because upstream now does what it did — and after the
verification that entry declares has passed. Entries the target does not touch are reviewed too: an
upstream change elsewhere can make a port unnecessary, and an unchanged file is not evidence that the
reason for patching it still holds.

The recorded release is a freshness marker, not a log. The reasoning behind each decision belongs to
the change that made it and to the repository's history, and `FORK.toml` SHALL remain a description
of the current boundary rather than an account of past ones.

#### Scenario: An entry has not been reviewed
- **WHEN** the boundary check runs and an entry records an older release than the adopted one
- **THEN** the check fails and names that entry

#### Scenario: An entry is advanced
- **WHEN** an entry records the adopted release
- **THEN** it has received an explicit keep, adapt, replace, or drop decision and its declared verification has passed

#### Scenario: The target does not touch an entry
- **WHEN** the adopted release changes none of an entry's declared paths
- **THEN** the entry is still reviewed and advanced deliberately, rather than advanced because nothing conflicted

#### Scenario: Upstream makes a port unnecessary
- **WHEN** the adopted release does downstream what an invasive entry was patching in
- **THEN** the entry is dropped and its paths return to upstream's versions

### Requirement: An adoption is merged as real ancestry

An adoption SHALL be a merge commit whose second parent is exactly the commit the selected tag
dereferences to. It MUST NOT be squashed, rebased, or replayed as cherry-picks. The ancestry is what
makes the *next* adoption a three-way merge with a real merge base; a fork that flattens one adoption
has to hand-port every one after it.

The merge SHALL be made on the branch this repository develops on, and SHALL NOT be pushed until the
boundary check, every entry's declared verification, and the repository's own lint, typecheck, test,
and version gates have passed. Pushing an adoption names the branch; upstream's tags arrive with the
fetch and stay local, as `fleet-release-publication` requires of any tag that is not this product's.

This repository's part in an adoption ends at that push. What a built adoption must prove on a
machine before it is trusted is not this repository's to state.

#### Scenario: An adoption is committed
- **WHEN** the merge is created
- **THEN** its second parent is exactly the dereferenced commit of the adopted tag

#### Scenario: An adoption is flattened
- **WHEN** an adoption would be squashed, rebased, or replayed as cherry-picks
- **THEN** it is rejected, because the next adoption would lose its merge base

#### Scenario: Gates have not passed
- **WHEN** the boundary check, entry verifications, or repository gates have not all passed
- **THEN** the adoption is not pushed

#### Scenario: The adoption is pushed
- **WHEN** the merge reaches the remote
- **THEN** the push names the branch, and the upstream tags fetched alongside it stay local

### Requirement: Collie's release history is retained accumulatively

`COLLIE_CHANGELOG.md` SHALL hold Collie's release history under its own name so that no entry of
Collie's is read as a release of this product's. Upstream does not only append to its changelog — it
has rewritten and truncated it — so retaining that file byte-for-byte and retaining Collie's history
are different things, and this repository SHALL do the second.

The adopted release's changelog SHALL appear verbatim at the top of the file, and SHALL remain a
byte-exact prefix of it, so the retention stays checkable rather than asserted. Entries upstream has
since dropped SHALL be kept below it word-for-word, and SHALL NOT be reordered, reformatted, or
merged into the upstream text. One marker line at the seam SHALL say that upstream truncated its own
file and that what follows is retained from an earlier adoption, so a reader is never shown a
continuous history upstream did not write.

Nothing of this product's SHALL be written into that file, and Collie's entries SHALL NOT be written
into this product's changelog.

#### Scenario: An adoption brings a rewritten upstream changelog
- **WHEN** the adopted release's changelog no longer contains entries the retained file has
- **THEN** the adopted text goes on top verbatim and the dropped entries are retained below it, unedited

#### Scenario: The retention is checked
- **WHEN** the boundary check runs
- **THEN** it fails unless the adopted release's changelog is a byte-exact prefix of the retained file

#### Scenario: A reader opens the retained file
- **WHEN** the file contains text from more than one adoption
- **THEN** a marker line at the seam says where upstream truncated and that what follows is retained

### Requirement: The boundary check runs on every change

The fork boundary check SHALL run in continuous integration on every change, not only when an
adoption is under way. A manifest is a porting guide for the next adoption, and one that drifted
between adoptions is discovered at the worst possible moment — with a merge already open.

The repository's local hooks SHALL be installed in a working checkout, so the guards that refuse
private facts, disagreeing version files, and unmarked releases run before a commit rather than after
a push.

#### Scenario: An ordinary change is pushed
- **WHEN** continuous integration runs on any change
- **THEN** the fork boundary check runs with the rest of the gates

#### Scenario: A checkout has no hooks installed
- **WHEN** work begins in a checkout whose hooks were never installed
- **THEN** they are installed before the work, because the guards they carry are otherwise inert
