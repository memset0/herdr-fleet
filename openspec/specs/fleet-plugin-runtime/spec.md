# fleet-plugin-runtime Specification

## Purpose

Defines the public-safe downstream plugin identity and the smallest owned runtime boundary needed to
run an authenticated Herdr Fleet lead while preserving the exact Collie baseline and its behavior.

## Requirements

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

### Requirement: Herdr owns the role-aware Fleet runtime lifecycle
The plugin SHALL run the exact child composition selected by its validated Fleet configuration and
native Pack authority state without requiring Collie's Tailscale publication or a separately
installed operating-system service.

A schema-1 Lead SHALL continue to run one loopback Collie child and one loopback authenticated
Gateway child with unchanged inputs. A schema-2 Lead SHALL run the same two child kinds after native
Lead authority validation and after its reachability mapping is validated against native membership.
A schema-2 Peer SHALL run one local loopback Collie child plus one supervised reachability link child,
and MUST NOT start a Gateway, Fleet session store, browser-authentication listener, or public listener.

Start, stop, restart, status, and failed-start cleanup MUST act only on the plugin-owned generation,
MUST report the configured role and exact child set without secrets, and MUST leave unrelated Herdr
state and terminal panes unchanged. A link child that exits MUST be recovered under its own bounded
backoff without restarting the Collie child, and stopping the plugin MUST leave no orphaned link
process or published projection.

#### Scenario: Existing schema-1 Lead starts
- **WHEN** Herdr starts the plugin with an unchanged valid schema-1 Lead configuration
- **THEN** one loopback Gateway and one loopback Collie child become ready with the same observable configuration and status as before this change

#### Scenario: Schema-2 Lead starts
- **WHEN** Herdr starts a schema-2 Lead whose configuration, native Pack authority state, and reachability mapping agree
- **THEN** one loopback Gateway and one loopback Collie child become ready and status identifies the Lead role without exposing trust or browser secrets

#### Scenario: Schema-2 Peer starts
- **WHEN** Herdr starts a schema-2 Peer whose configuration and native Pack authority state agree
- **THEN** one loopback Collie child and one reachability link child become ready, no Gateway or browser listener exists, and status identifies the Peer role and the link layer separately

#### Scenario: The link child exits while Collie is healthy
- **WHEN** a schema-2 Peer's link child exits
- **THEN** only the link child is retried under bounded backoff, the Collie child keeps running, and status reports the Peer as not ready until the link is re-established

#### Scenario: Startup fails after a child was created
- **WHEN** a required child cannot become ready or configuration/authority/reachability validation fails
- **THEN** the attempted generation is cleaned up, no unintended listener or published projection is left behind, and unrelated Herdr processes and panes remain untouched

### Requirement: Upstream Tailscale support is retained but inactive in the Fleet profile

The fork SHALL retain Collie's upstream Tailscale serve and identity implementation for compatibility.
The Herdr Fleet lead profile MUST instead select external ingress, MUST NOT manage a Tailscale serve
mapping, and MUST treat its own password/session Gateway as the public browser authorization
boundary. A retained Tailscale header check MUST NOT be documented or reported as protecting a Fleet
profile that does not use it.

#### Scenario: Fleet profile starts
- **WHEN** the downstream plugin launches Collie behind its Gateway
- **THEN** Collie remains on loopback with Tailscale publication skipped and browser access is governed by the Fleet session boundary

#### Scenario: Upstream compatibility is reviewed
- **WHEN** a future upstream merge inspects the retained Tailscale implementation
- **THEN** the implementation remains available as upstream functionality while the downstream Fleet selection is isolated to owned configuration and lifecycle code

### Requirement: A check refuses a tree carrying a private fact
The repository SHALL carry a check that refuses a tracked tree containing a private fact, and that
check SHALL run as a commit-time guard independent of the others, with its own named escape hatch.

It SHALL detect by shape rather than by a list of forbidden values, because a list is the leak it
exists to prevent. The shapes it refuses SHALL include an IP address outside loopback and the
documentation ranges, an absolute path under a user's home directory, and material shaped like a
private key, a password verifier or a long opaque secret.

It SHALL scan the paths this fork declares as its own and no others, because a finding in an upstream
file that is already public upstream teaches its reader to ignore the guard.

Where a private value has no usable shape — a machine whose name is an ordinary word, and any
hostname, whose shape cannot be told from that of a public one — the check SHALL read those names from
the repository's ignored local context file when it is present, so they are caught without any of them
being written into the tree.

The publisher's own identity SHALL be exempt: the repository owner, the license attribution and the
stable plugin identifier are intentional public metadata and MUST NOT be reported.

The check SHALL state plainly what it does not cover, so a passing run is not read as a proof of
absence.

#### Scenario: A real deployment fact is committed
- **WHEN** a fork-owned tracked file gains a non-documentation address, a home-directory path, or credential-shaped material
- **THEN** the guard refuses the commit and names the file, the line and the shape it matched, without repeating any value it read from the local context file

#### Scenario: The same shape appears in an upstream file
- **WHEN** a file outside the fork's declared paths carries one of those shapes
- **THEN** the guard passes, because that file is upstream's to publish

#### Scenario: A synthetic example is committed
- **WHEN** a tracked file uses a reserved example domain, a loopback or documentation address, or a synthetic path
- **THEN** the guard passes

#### Scenario: The publisher is named
- **WHEN** a tracked file carries the repository owner, the license attribution or the plugin identifier
- **THEN** the guard passes, because that is the publisher's own identity

#### Scenario: A shapeless private name is committed
- **WHEN** a fork-owned tracked file gains a private machine or host name that carries no usable shape, and the local context file names it
- **THEN** the guard refuses, and when that file is absent the guard passes and its own output has already said that this is the case it cannot see

#### Scenario: The guard is in the way
- **WHEN** an operator must commit past it once
- **THEN** its own named hatch skips it and disarms neither the version, lint nor pack-wire guard

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

### Requirement: This product's changelog is its own file, and upstream's is preserved verbatim
This product SHALL keep its own changelog, in the same Keep a Changelog format, in a file distinct
from the one upstream maintains. Entries for this product's changes SHALL NEVER be interleaved into
upstream's, because a merged file cannot be read as either project's history and cannot be reconciled
when upstream's own file moves.

Upstream's changelog SHALL be retained exactly as upstream wrote it, as provenance, and SHALL NOT
gain, lose or reorder an entry.

The working agreement SHALL direct every functional change to this product's own file, so an agent
adding a changelog line is told which file before it needs to ask.

#### Scenario: A functional change is committed
- **WHEN** a change adds its changelog line
- **THEN** the line lands in this product's own changelog and upstream's is untouched

#### Scenario: Upstream's changelog is read
- **WHEN** upstream's changelog is compared with the release it came from
- **THEN** it is byte-identical to what upstream wrote

#### Scenario: The version is checked
- **WHEN** the version consistency check runs
- **THEN** it reads this product's own changelog for the newest numbered heading
