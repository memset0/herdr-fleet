# fleet-pack-authority Specification

## Purpose

Defines how Herdr Fleet selects Collie's native Pack as the sole machine-membership authority while
keeping browser authentication, lifecycle selection, and future reachability transport separate.

## Requirements

### Requirement: Browser sessions and Pack admission are separate authority planes

Herdr Fleet SHALL use its configured browser session only to authorize a browser's requests to the
Lead Gateway. It MUST NOT send, copy, translate, expose, or derive the Fleet username, password,
password hash, session secret, session identifier, or signed session cookie into a Pack request,
Pack environment value, peer process, or Collie Pack trust record.

An authenticated browser MAY reach normal native Collie UI and API routes through the Lead Gateway,
but the Gateway MUST continue to deny every path on the machine-to-machine link without proxying it:
the current crew prefix `/crew/v1/*` and the previous pack prefix `/pack/v1/*` alike, for as long as
the adopted Collie answers either. The browser-facing crew page `/crew` and its `/pack` redirect are
application routes, not link paths, and are not denied by this rule. Fleet browser authentication
MUST NOT admit a machine, satisfy either native Pack factor, or grant a peer access to the Lead.

#### Scenario: Authenticated browser requests a normal native API
- **WHEN** a valid Fleet browser session requests a normal native UI or `/api/*` route through the Lead Gateway
- **THEN** the Gateway applies its existing browser policy and proxies the request without delegating the Fleet credential to Pack

#### Scenario: Authenticated browser requests a Pack path
- **WHEN** a valid Fleet browser session requests any `/crew/v1/*` or `/pack/v1/*` path from the public Gateway
- **THEN** the Gateway returns its public not-found denial and never contacts Collie

#### Scenario: Authenticated browser opens the crew page
- **WHEN** a valid Fleet browser session navigates to the crew page
- **THEN** the Gateway serves it as an ordinary application route under its existing browser policy

#### Scenario: Collie child environment is constructed
- **WHEN** Fleet starts a Lead or Peer Collie child
- **THEN** the child receives no Fleet browser username, password hash, session secret, session token, or cookie

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

### Requirement: Fleet refuses a trust store in the pre-Collie-1.9 inner shape

Collie 1.9 and later read a trust store's crew identity from its top-level `crew` key only, and read a
document without it as a store that holds no crew. Before Collie's reader runs, Herdr Fleet SHALL
inspect the raw trust-store document under the current file name in the state directory it validates
and, for an explicit enrolment, the one it would write. It SHALL do so when it validates native Pack
authority at start, on the daemon and the control path alike, and before any operator-invoked
enrolment action opens the store.

A document whose top level has a `pack` key and no `crew` key is the pre-Collie-1.9 inner shape.
Fleet SHALL refuse it: startup fails closed before any child starts, and an enrolment action fails
before minting identity, contacting a lead or writing anything. The refusal SHALL name the file and
SHALL say that the store must be rewritten by the member's previous Fleet release (3.4.x), through
that release's own trust-store no-op commit, before this release runs. It SHALL name keys only and
MUST NOT include any value from the document.

A document that has a `crew` key SHALL proceed unchanged to Collie's reader, whether or not it also
has a `pack` key. A missing, unparseable or non-object document is not decided by this rule; it
proceeds to the existing absent or invalid trust-state handling. Fleet MUST NOT rewrite, reshape,
rename or otherwise modify the trust store in any of these cases.

#### Scenario: A crew-shaped store starts
- **WHEN** the trust store's top level has a `crew` key and its role matches the configured role
- **THEN** authority validation succeeds exactly as before and the store is unchanged

#### Scenario: A pack-shaped store is refused at start
- **WHEN** the trust store's top level has a `pack` key and no `crew` key
- **THEN** Fleet fails startup before any child starts, with a notice naming the file, the `pack` and `crew` keys and the previous release's no-op commit, containing no value from the store, and the state directory is byte-for-byte unchanged

#### Scenario: A pack-shaped store is refused before enrolment
- **WHEN** an operator invokes an enrolment action against a state directory whose trust store has a `pack` key and no `crew` key
- **THEN** the action refuses with the same notice before minting identity or contacting the lead, and the state directory is byte-for-byte unchanged

#### Scenario: Both keys are present
- **WHEN** the trust store's top level has both a `crew` key and a `pack` key
- **THEN** Fleet proceeds to Collie's reader, which reads `crew`, and the store is unchanged

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
