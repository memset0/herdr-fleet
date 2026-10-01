# fleet-version-evidence Specification

## Purpose

Define truthful, read-only Fleet runtime-version evidence for the authenticated native shell, judged against the lead's own running version, without granting update authority or reaching outside the lead.

## Requirements

### Requirement: Host state uses observed runtime identity without confusing compatibility
Each host SHALL be classified from the full version reported by that running member against the lead's own runtime version, read from the same crew census response that carries the member reports. Only major.minor participates in the comparison; the lead's patch, prerelease and build metadata do not. A member in the same major whose minor is lower than the lead's SHALL be outdated. A member sharing the lead's major.minor SHALL be compatible, and patch differences MUST NOT be presented as a required peer update. A lead whose major is higher than the member's SHALL produce a manual-major state that does not imply unattended migration. A member that reports no lower major.minor than the lead SHALL be compatible.

An absent or unparseable member identity SHALL be unknown, not current, and SHALL be presented as "Version unknown" without echoing the raw reported value; only a parseable identity is shown in full. When the lead's own runtime version is absent or unparseable, no comparison SHALL be asserted and a reachable member's state SHALL be unknown. An identity carrying an explicit SemVer prerelease such as `-dev` SHALL remain development and SHALL NOT be ordered as proof of a formal release solely from its numeric prefix; build metadata such as `+2fc727c` on an otherwise stable version SHALL remain stable runtime identity. A host that is not currently answering MAY retain its observed version, but that value SHALL be identified as last reported. Runtime evidence MUST NOT be relabelled as a verified on-disk installation or desired target, and no state SHALL describe when a reference was last checked or whether it is fresh: the reference is the live lead version from the same read.

#### Scenario: Host runs an older minor
- **WHEN** a host reports `3.2.0` and the lead reports `3.3.1`
- **THEN** its state is outdated and retains the full reported `3.2.0`

#### Scenario: Host differs only by patch
- **WHEN** a host reports `3.3.0` and the lead reports `3.3.2+abc1234`
- **THEN** its state remains compatible rather than requiring a peer update

#### Scenario: A later major is published
- **WHEN** a host reports major 3 and the lead reports major 4
- **THEN** its state requires manual major migration and offers no unattended update action

#### Scenario: A development identity is reported
- **WHEN** a member reports a numeric version with an explicit prerelease such as `-dev`
- **THEN** the full identity is shown as development and is not treated as formal-tag installation evidence, while `+commit` build metadata alone does not make a version developmental

#### Scenario: An offline host previously reported a version
- **WHEN** a host stops answering after reporting a version
- **THEN** the version remains visible as last reported while connectivity keeps its independent state

#### Scenario: A host has no valid reported version
- **WHEN** the member identity is absent or unparseable
- **THEN** its version state is unknown, the row reports "Version unknown" without echoing the raw value, and no lead version is substituted

#### Scenario: The lead's own version cannot be read
- **WHEN** the census carries no parseable lead runtime version
- **THEN** no reachable member is called compatible, outdated or manual-major, and its state is unknown

### Requirement: The shell receives one read-only version view through its existing application boundary
The authenticated application surface SHALL expose the minimum shared version view needed by the shell. The view SHALL consist of the lead's own runtime version and the member versions already observed by Collie's crew census (`/api/crew`, which replaces `/api/pack`), both taken from one census response, and SHALL add no peer request, crew protocol field, new listener, Gateway route, outbound request, alternate router, or browser credential. The view SHALL NOT depend on the previous census path or its redirect, which the adopted Collie keeps for one release only. Census discovery MUST NOT delay the first usable snapshot or navigation; React Router revalidation SHALL pick up the retained shared view after the optional read settles. Host rows SHALL create neither their own request nor their own polling timer.

#### Scenario: Several hosts render in one shell
- **WHEN** the shell displays multiple host rows
- **THEN** all rows consume the same loaded version view and no row starts a request or timer

#### Scenario: The shell revalidates
- **WHEN** the existing React Router poll refreshes root data
- **THEN** one read-only version view is refreshed without changing host navigation or terminal state

#### Scenario: The census is read
- **WHEN** the shell loads member versions
- **THEN** it reads the crew census directly, takes the lead's version from the same response, and never relies on the previous path's redirect

#### Scenario: Version evidence is gathered
- **WHEN** the lead serves the shell and its Host rows classify versions
- **THEN** no request leaves the lead for version evidence and no published-release route is consulted

### Requirement: The native footer reports the current page build
The shared native footer SHALL identify `Herdr Fleet` and the build identity compiled into the current page. It SHALL preserve a development marker and available commit identity rather than hardcoding the manifest version or borrowing a selected host's runtime version.

The build label SHALL appear below the existing Collie/TTYD surface selector in both the desktop hierarchy rail and the mobile hierarchy drawer. It SHALL remain available when no member answers or the crew census is unavailable and SHALL preserve both surface choices, their behavior, and narrow-screen access.

#### Scenario: A formal Fleet build is rendered
- **WHEN** either native navigation surface is visible for a formal build
- **THEN** the footer shows its Herdr Fleet version below both unchanged surface choices

#### Scenario: A development build is rendered
- **WHEN** the page was compiled from a development revision
- **THEN** the footer retains its development and available commit identity

#### Scenario: Host selection or release availability changes
- **WHEN** the selected host changes or the crew census cannot be read
- **THEN** the footer continues to show the same page build and both surface choices remain usable
