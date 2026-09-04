## MODIFIED Requirements

### Requirement: The v3 line has an explicit downstream identity and provenance
The plugin SHALL identify itself as `memset0.herdr-fleet` and as Herdr Fleet while recording Collie
v1.2.0 tag object `0f98f28c9aaadd641c4bc5ac484190ee3ef7008c` and commit
`4618c90534d6f818ed6788b8db00e1582c5abfdc` as its upstream baseline. It MUST preserve Collie's
license and attribution, and it MUST NOT represent unchanged Collie behavior as downstream
functionality.

The version SHALL be this product's own, beginning at `3.0.0`, and SHALL move on this product's own
changes rather than on an upstream release. The upstream baseline above is provenance beside it, not
a component of it: adopting a later Collie release changes that record and says nothing about this
product's version.

The line development happens on SHALL be the repository's default branch, and a superseded generation
SHALL be retained under a branch naming both its own last release and the upstream release it
carried. No commit SHALL be rewritten and no branch force-updated to achieve either.

#### Scenario: Plugin metadata is inspected
- **WHEN** an operator or packaging tool reads the plugin metadata and fork provenance
- **THEN** it finds the downstream plugin id and name, the exact Collie v1.2.0 baseline, and retained upstream attribution without a private deployment reference

#### Scenario: The development candidate reports its lineage
- **WHEN** a development candidate is built before an owner-approved release is cut
- **THEN** its output can be tied to an exact commit on the development line without creating a release tag or claiming a different upstream baseline

#### Scenario: The version is read
- **WHEN** the manifest, both package files and the newest numbered changelog heading are compared
- **THEN** they agree on this product's own version, and the upstream baseline is stated separately as provenance

#### Scenario: A later upstream release is adopted
- **WHEN** the reapplication moves to a newer Collie release
- **THEN** the provenance record changes and this product's version moves only if this product changed

#### Scenario: The repository is cloned
- **WHEN** a clone is made with no branch named
- **THEN** it arrives on the line development happens on, and the superseded generation remains reachable by its own branch and its tags

### Requirement: Fleet-owned behavior stays outside upstream business logic
The authenticated Gateway, private configuration reader, session state, login presentation, proxy,
and Herdr-coupled lifecycle SHALL live in explicit downstream-owned roots. Any necessary edit to an
upstream-owned path MUST expose only a narrow identity, lifecycle, configuration, static-routing, or
service-worker port and MUST be listed exactly in `FORK.toml` with its reason and verification.

Invasiveness SHALL be minimised rather than merely declared: where a downstream-owned module can
carry the behaviour, it does, and an upstream-owned path is edited only when no owned module can
reach what the change needs. `FORK.toml` SHALL be updated by the same change that moves the
boundary, so the manifest is never a description of a previous tree.

Collie's decision records under `.adr/` SHALL NOT be modified, added to, or removed. They record
upstream's own reasoning about upstream's own tree, and a downstream edit to one makes an upstream
document say something upstream never decided. A downstream decision that would otherwise want an
ADR SHALL be recorded in this repository's root instruction file instead.

Where a rule in this repository's root instruction file conflicts with any other guidance, including
guidance inherited from upstream, the root instruction file governs, and the conflict SHALL be
recorded there rather than resolved silently at the call site.

#### Scenario: A downstream behavior is added
- **WHEN** implementation places authentication, configuration, or lifecycle behavior in the source tree
- **THEN** the behavior resides in a declared owned root and any upstream-owned edit contains only the minimum adapter port recorded by the same change

#### Scenario: The fork boundary is audited
- **WHEN** the implemented tree is compared with the exact Collie baseline
- **THEN** every changed path is classified by `FORK.toml`, every invasive path has a specific reason and verification, and no unclassified downstream path remains

#### Scenario: An owned module could carry the behaviour
- **WHEN** a change could place behaviour either in an owned module or in an upstream-owned path
- **THEN** it goes in the owned module, and no invasive path is declared for it

#### Scenario: A downstream decision wants a record
- **WHEN** a decision would close off an option someone will reasonably propose again
- **THEN** it is recorded in the root instruction file and `.adr/` is left exactly as upstream wrote it

#### Scenario: Guidance conflicts
- **WHEN** the root instruction file and any other guidance disagree about this tree
- **THEN** the root instruction file governs and the conflict is written down there

## ADDED Requirements

### Requirement: The release axis is who must redeploy, and it decides who may cut it
This product's version SHALL move on an axis of deployment reach: which machines a change obliges to
be redeployed. That is the question its operator actually has to answer, and it is not the same
question upstream's own axis asks.

- **Major** — the operator must change something themselves: a configuration key, an enrolment, a
  contract. A major release SHALL be cut by the owner and never automatically.
- **Minor** — every member must take the change: it touches what a member runs, so each machine in
  the pack is redeployed. A minor release MAY be cut without asking, once the change is verified.
- **Patch** — only the machine serving the browser takes the change: nothing a member runs is
  affected, a frontend-only change being the ordinary case, because a member serves no browser at
  all. A patch release MAY be cut without asking and without announcement.

A change that alters no released artifact — documentation alone — SHALL bump nothing, as it does
today.

Every implemented change SHALL be assessed against this axis when it is verified, and a release cut
when the axis says one is warranted. Leaving a releasable change unreleased is a decision that
SHALL be stated rather than a step quietly skipped.

#### Scenario: A change alters what a member runs
- **WHEN** a verified change means every member of the pack must be redeployed
- **THEN** it is a minor release, cut without asking

#### Scenario: A change reaches only the browser
- **WHEN** a verified change needs redeploying only where the browser is served, a frontend change being the ordinary case
- **THEN** it is a patch release, cut without asking

#### Scenario: A change obliges the operator to act
- **WHEN** a verified change requires the operator to alter configuration, membership or a contract
- **THEN** it is a major release, and it waits for the owner rather than being cut

#### Scenario: A change is released
- **WHEN** any release is cut
- **THEN** it is one commit that does nothing but the release, and an annotated tag on it, and the assessment that chose the level is recorded with the change

### Requirement: A release is one commit that does nothing else
A release SHALL be a single `chore(release): x.y.z` commit that bumps the three version files,
renames the unreleased changelog heading to that version with its real date and each of its entries'
short commit hash in the file's own link style, and re-creates an empty unreleased heading above it.
It SHALL contain no other change, and no other commit SHALL touch the version files.

The commit SHALL be tagged with an annotated `v<x.y.z>` tag and pushed with it, because the tag is
what publishes the release and a cut version that is never tagged is not a release at all.

#### Scenario: A release commit is inspected
- **WHEN** a release commit is read
- **THEN** it contains the three version files and the changelog and nothing else

#### Scenario: A release is pushed
- **WHEN** a release commit reaches the remote
- **THEN** its annotated tag reaches it in the same push, and the version check passes on that commit

