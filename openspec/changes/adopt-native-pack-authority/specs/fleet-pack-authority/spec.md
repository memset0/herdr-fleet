## Purpose

Defines how Herdr Fleet selects Collie's native Pack as the sole machine-membership authority while
keeping browser authentication, lifecycle selection, and future reachability transport separate.

## ADDED Requirements

### Requirement: Browser sessions and Pack admission are separate authority planes
Herdr Fleet SHALL use its configured browser session only to authorize a browser's requests to the
Lead Gateway. It MUST NOT send, copy, translate, expose, or derive the Fleet username, password,
password hash, session secret, session identifier, or signed session cookie into a Pack request,
Pack environment value, peer process, or Collie Pack trust record.

An authenticated browser MAY reach normal native Collie UI and API routes through the Lead Gateway,
but the Gateway MUST continue to deny every `/pack/v1/*` path without proxying it. Fleet browser
authentication MUST NOT admit a machine, satisfy either native Pack factor, or grant a peer access
to the Lead.

#### Scenario: Authenticated browser requests a normal native API
- **WHEN** a valid Fleet browser session requests a normal native UI or `/api/*` route through the Lead Gateway
- **THEN** the Gateway applies its existing browser policy and proxies the request without delegating the Fleet credential to Pack

#### Scenario: Authenticated browser requests a Pack path
- **WHEN** a valid Fleet browser session requests any `/pack/v1/*` path from the public Gateway
- **THEN** the Gateway returns its public not-found denial and never contacts Collie

#### Scenario: Collie child environment is constructed
- **WHEN** Fleet starts a Lead or Peer Collie child
- **THEN** the child receives no Fleet browser username, password hash, session secret, session token, or cookie

### Requirement: Native Pack trust state is the canonical machine authority
When schema 2 selects native Pack lifecycle, Herdr Fleet SHALL read Collie's existing Pack trust
state through Collie's own trust reader and mode derivation. That state SHALL remain the canonical
source of Pack identity, local member identity, membership, pinned certificates, Pack secret
generation, signatures, and native Lead or Peer mode.

Fleet MUST NOT create, initialize, repair, rewrite, migrate, enroll, remove, rotate, or otherwise
modify Pack trust state. A missing, unreadable, structurally invalid, conflicting, solo, or
configured-role-mismatched trust state MUST fail schema-2 startup before any child starts, without
replacing the file or falling back to a Fleet-maintained roster.

#### Scenario: Configured Lead matches native trust state
- **WHEN** schema 2 declares `role = "lead"` and Collie's valid trust state derives native Lead mode
- **THEN** authority validation succeeds without changing Pack state

#### Scenario: Configured Peer matches native trust state
- **WHEN** schema 2 declares `role = "peer"` and Collie's valid trust state derives native Peer mode
- **THEN** authority validation succeeds without changing Pack state

#### Scenario: Trust state is absent or disagrees with configuration
- **WHEN** native Pack lifecycle is selected but Collie's trust state is absent, invalid, conflicted, solo, or derives a different role
- **THEN** Fleet fails closed before starting Collie or Gateway and leaves the trust state byte-for-byte unchanged

### Requirement: Fleet preserves native Pack authority boundaries without reimplementation
Herdr Fleet SHALL leave Pack request admission, pinned mutual TLS, Pack secret and signature checks,
membership transitions, strict secret rotation, native router/loaders, Pack UI, member access, and
software-update authority to Collie's existing Pack implementation and `PACK_PROTOCOL.md`.

Fleet MUST NOT add a second Pack listener, public Pack proxy, sibling-to-sibling route, remote
software-update path, enrollment action, rotation action, trust mutation, Host aggregation layer,
alternate Pack router, alternate loader, or alternate Pack UI. In particular, Fleet MUST NOT weaken
the native rule that a Lead can operate enrolled members while an ordinary Peer remains isolated
from siblings and has no Pack software-update authority; an offline member excluded by native
no-grace secret rotation remains subject to explicit re-enrollment rather than a Fleet fallback.

#### Scenario: Native Pack behavior is selected
- **WHEN** schema-2 authority validation succeeds
- **THEN** Fleet starts the role-appropriate local runtime while Collie's existing Pack implementation remains the only component enforcing machine admission and member authority

#### Scenario: Peer has no transport projection yet
- **WHEN** a schema-2 Peer starts before a future reachability change is installed
- **THEN** its native Pack listener remains on the configured loopback Collie endpoint and Fleet creates no public or remote path to it

#### Scenario: Native rotation excludes an offline member
- **WHEN** Collie's native strict rotation leaves a member unenrolled
- **THEN** Fleet neither retains a grace secret nor synthesizes membership and the member requires native re-enrollment
