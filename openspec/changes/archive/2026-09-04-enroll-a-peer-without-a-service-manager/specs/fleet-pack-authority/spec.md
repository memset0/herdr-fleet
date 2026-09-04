## MODIFIED Requirements

### Requirement: Native Pack trust state is the canonical machine authority
When schema 2 selects native Pack lifecycle, Herdr Fleet SHALL read Collie's existing Pack trust
state through Collie's own trust reader and mode derivation. That state SHALL remain the canonical
source of Pack identity, local member identity, membership, pinned certificates, Pack secret
generation, signatures, and native Lead or Peer mode.

The Fleet runtime MUST NOT create, initialize, repair, rewrite, migrate, enroll, remove, rotate, or
otherwise modify Pack trust state. A missing, unreadable, structurally invalid, conflicting, solo, or
configured-role-mismatched trust state MUST fail schema-2 startup before any child starts, without
replacing the file or falling back to a Fleet-maintained roster.

An explicit operator-invoked enrolment is the one exception, and it is not a runtime path: it applies
Collie's own transitions through Collie's own persistence seam, never a Fleet-defined record, and
never as a side effect of starting, restarting or supervising anything.

#### Scenario: Configured Lead matches native trust state
- **WHEN** schema 2 declares `role = "lead"` and Collie's valid trust state derives native Lead mode
- **THEN** authority validation succeeds without changing Pack state

#### Scenario: Configured Peer matches native trust state
- **WHEN** schema 2 declares `role = "peer"` and Collie's valid trust state derives native Peer mode
- **THEN** authority validation succeeds without changing Pack state

#### Scenario: Trust state is absent or disagrees with configuration
- **WHEN** native Pack lifecycle is selected but Collie's trust state is absent, invalid, conflicted, solo, or derives a different role
- **THEN** Fleet fails closed before starting Collie or Gateway and leaves the trust state byte-for-byte unchanged

#### Scenario: An operator enrols a peer
- **WHEN** an operator invokes enrolment explicitly
- **THEN** Collie's own transitions persist the change through Collie's own seam, and no runtime path gains the ability to do so
