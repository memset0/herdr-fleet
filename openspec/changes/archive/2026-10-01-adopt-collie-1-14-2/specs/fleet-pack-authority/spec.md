## MODIFIED Requirements

### Requirement: Native Pack trust state is the canonical machine authority
When schema 2 selects native Pack lifecycle, Herdr Fleet SHALL read Collie's existing Pack trust
state through Collie's own trust reader and mode derivation. That state SHALL remain the canonical
source of Pack identity, local member identity, membership, pinned certificates, Pack secret
generation, signatures, and native Lead or Peer mode.

Fleet SHALL read the trust state under the one file name the adopted Collie reads and writes, from
the same state directory Fleet starts Collie against. The adopted Collie no longer moves a previous
release's file names and reads only its own; so Fleet SHALL NOT fall back to a previous name either.
A state directory that holds only the previous release's trust-state name SHALL be treated as absent
trust state, and the refusal SHALL carry Collie's own notice naming the hand edits that recover it.

The Fleet runtime MUST NOT create, initialize, repair, rewrite, rename, migrate, enroll, remove,
rotate, or otherwise modify Pack trust state. A missing, unreadable, structurally invalid,
conflicting, solo, or configured-role-mismatched trust state MUST fail schema-2 startup before any
child starts, without replacing the file or falling back to a Fleet-maintained roster.

An explicit operator-invoked enrolment is the one exception, and it is not a runtime path: it applies
Collie's own transitions through Collie's own persistence seam, never a Fleet-defined record, and
never as a side effect of starting, restarting or supervising anything. It SHALL refuse to open a
state directory that holds only the previous release's trust-state name, with the same notice, so an
enrolment can never leave a second trust store beside the first.

#### Scenario: Configured Lead matches native trust state
- **WHEN** schema 2 declares `role = "lead"` and Collie's valid trust state derives native Lead mode
- **THEN** authority validation succeeds without changing Pack state

#### Scenario: Configured Peer matches native trust state
- **WHEN** schema 2 declares `role = "peer"` and Collie's valid trust state derives native Peer mode
- **THEN** authority validation succeeds without changing Pack state

#### Scenario: The first start after an upgrade
- **WHEN** Fleet first starts on the adopted release on a machine whose Collie already ran the previous release
- **THEN** the trust state is already under the current name, Fleet validates it in place, and nothing is renamed or moved

#### Scenario: Only the previous release's file name is present
- **WHEN** the state directory holds the previous trust-state file name and not the current one
- **THEN** Fleet fails closed before starting Collie, reports Collie's own notice with the hand edits, and leaves both the file and its name unchanged

#### Scenario: Both file names are present
- **WHEN** the current and the previous trust-state file names both exist
- **THEN** Fleet validates from the current name and touches neither file

#### Scenario: Trust state is absent or disagrees with configuration
- **WHEN** native Pack lifecycle is selected but Collie's trust state is absent, invalid, conflicted, solo, or derives a different role
- **THEN** Fleet fails closed before starting Collie or Gateway and leaves the trust state byte-for-byte unchanged

#### Scenario: An operator enrols a peer
- **WHEN** an operator invokes enrolment explicitly against a state directory that carries the current name or none
- **THEN** Collie's own transitions persist the change through Collie's own seam, and no runtime path gains the ability to do so

#### Scenario: An operator enrols against a legacy-named store
- **WHEN** an operator invokes enrolment and the state directory holds only the previous trust-state file name
- **THEN** enrolment refuses with Collie's own notice and writes nothing

### Requirement: Fleet preserves native Pack authority boundaries without reimplementation

Herdr Fleet SHALL leave Pack request admission, pinned mutual TLS, Pack secret and signature checks,
membership transitions, strict secret rotation, native router/loaders, Pack UI, member access,
protocol-version negotiation and the protocol floor it enforces, and software-update authority to
Collie's existing crew implementation and `CREW_PROTOCOL.md`.

Fleet MUST NOT add a second Pack listener, public Pack proxy, sibling-to-sibling route, remote
software-update path, enrollment action, rotation action, trust mutation, Host aggregation layer,
alternate Pack router, alternate loader, alternate protocol-version fallback, or alternate Pack UI.
In particular, Fleet MUST NOT weaken the native rule that a Lead can operate enrolled members while an
ordinary Peer remains isolated from siblings and has no Pack software-update authority; an offline
member excluded by native no-grace secret rotation remains subject to explicit re-enrollment rather
than a Fleet fallback.

#### Scenario: Native Pack behavior is selected
- **WHEN** schema-2 authority validation succeeds
- **THEN** Fleet starts the role-appropriate local runtime while Collie's existing crew implementation remains the only component enforcing machine admission and member authority

#### Scenario: Members run different protocol versions
- **WHEN** a lead and a member run releases that do not share a crew protocol version
- **THEN** Collie's own preflight and crew status report the member as incompatible, and Fleet adds no translation, fallback or compatibility path of its own

#### Scenario: Peer has no transport projection yet
- **WHEN** a schema-2 Peer starts before a future reachability change is installed
- **THEN** its native Pack listener remains on the configured loopback Collie endpoint and Fleet creates no public or remote path to it

#### Scenario: Native rotation excludes an offline member
- **WHEN** Collie's native strict rotation leaves a member unenrolled
- **THEN** Fleet neither retains a grace secret nor synthesizes membership and the member requires native re-enrollment
