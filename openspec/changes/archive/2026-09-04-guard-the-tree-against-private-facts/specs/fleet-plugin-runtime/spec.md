## ADDED Requirements

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
