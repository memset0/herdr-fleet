## Purpose

Define truthful, read-only Fleet release and runtime-version evidence for the authenticated native shell without granting update authority.

## ADDED Requirements

### Requirement: Published Fleet release evidence is stable, numeric, shared, and fresh
The product SHALL observe only annotated stable `vMAJOR.MINOR.PATCH` tags from its fixed Fleet repository and SHALL order their numeric semantic versions rather than tag text, branch position, publication time, prereleases, or upstream Collie Releases. Requests SHALL be time-bounded, shared and coalesced so one shell refresh cannot issue an independent release-source request for every host.

The observation SHALL include when it was checked and whether the retained result remains fresh. A failed request MAY retain the last successful observation, but stale or unavailable evidence MUST NOT be presented as a fresh current/outdated conclusion. Observation SHALL be read-only and MUST NOT install, restart, enroll, publish, select a deployment target, access operator SSH credentials, or invoke Collie's updater.

#### Scenario: Concurrent shell consumers ask for release evidence
- **WHEN** several consumers request release evidence before the same source request settles
- **THEN** they share one bounded observation and receive the same checked-at and freshness result

#### Scenario: Tags do not sort lexically
- **WHEN** stable tags include `v3.9.0` and `v3.10.0`
- **THEN** the observer identifies `v3.10.0` as newer

#### Scenario: The source also exposes non-release refs
- **WHEN** branch heads, lightweight tags, malformed tags, or prerelease tags are present beside stable annotated tags
- **THEN** none of those refs becomes Fleet release evidence

#### Scenario: Release discovery fails after a previous success
- **WHEN** the source cannot be checked and retained evidence has exceeded its freshness window
- **THEN** the response marks release freshness unavailable or last checked and does not assert a new current/outdated conclusion

### Requirement: Host state uses observed runtime identity without confusing compatibility
Each host SHALL be classified from the full version reported by that running member and the shared published-release evidence. A higher minor in the same major SHALL be outdated. Patch differences within the same major.minor SHALL remain compatible and MUST NOT be presented as a required peer update. A higher published major SHALL produce a manual-major state that does not imply unattended migration.

An absent or unparseable identity SHALL be unknown, not current, and SHALL be presented as "Version unknown" without echoing the raw reported value; only a parseable identity is shown in full. An identity carrying an explicit SemVer prerelease such as `-dev` SHALL remain development and SHALL NOT be ordered as proof of a formal release solely from its numeric prefix; build metadata such as `+2fc727c` on an otherwise stable version SHALL remain stable runtime identity. A host that is not currently answering MAY retain its observed version, but that value SHALL be identified as last reported. Runtime evidence MUST NOT be relabelled as a verified on-disk installation or desired target.

#### Scenario: Host runs an older minor
- **WHEN** a host reports `3.2.0` and fresh release evidence includes `v3.3.0`
- **THEN** its state is outdated and retains the full reported `3.2.0`

#### Scenario: Host differs only by patch
- **WHEN** a host reports `3.3.0` and fresh release evidence includes `v3.3.2`
- **THEN** its state remains compatible rather than requiring a peer update

#### Scenario: A later major is published
- **WHEN** a host reports major 3 and fresh release evidence identifies major 4
- **THEN** its state requires manual major migration and offers no unattended update action

#### Scenario: A development identity is reported
- **WHEN** a member reports a numeric version with an explicit prerelease such as `-dev`
- **THEN** the full identity is shown as development and is not treated as formal-tag installation evidence, while `+commit` build metadata alone does not make a version developmental

#### Scenario: An offline host previously reported a version
- **WHEN** a host stops answering after reporting a version
- **THEN** the version remains visible as last reported while connectivity keeps its independent state

#### Scenario: A host has no valid reported version
- **WHEN** the member identity is absent or unparseable
- **THEN** its version state is unknown, the row reports "Version unknown" without echoing the raw value, and no lead or release version is substituted

### Requirement: The shell receives one read-only version view through its existing application boundary
The authenticated application surface SHALL expose the minimum shared version view needed by the shell. The view SHALL reuse member versions already observed by `/api/pack` and SHALL add no peer request, Pack protocol field, new listener, alternate router, or browser credential. Release and member discovery MUST NOT delay the first usable snapshot or navigation; React Router revalidation SHALL pick up the retained shared view after optional reads settle. Host rows SHALL create neither their own request nor their own polling timer.

#### Scenario: Several hosts render in one shell
- **WHEN** the shell displays multiple host rows
- **THEN** all rows consume the same loaded version view and no row starts a request or timer

#### Scenario: The shell revalidates
- **WHEN** the existing React Router poll refreshes root data
- **THEN** one read-only version view is refreshed without changing host navigation or terminal state

### Requirement: The native footer reports the current page build
The shared native footer SHALL identify `Herdr Fleet` and the build identity compiled into the current page. It SHALL preserve a development marker and available commit identity rather than hardcoding the manifest version or borrowing a selected host's runtime version.

The build label SHALL appear below the existing Collie/TTYD surface selector in both the desktop hierarchy rail and the mobile hierarchy drawer. It SHALL remain available when no member answers or release discovery is unavailable and SHALL preserve both surface choices, their behavior, and narrow-screen access.

#### Scenario: A formal Fleet build is rendered
- **WHEN** either native navigation surface is visible for a formal build
- **THEN** the footer shows its Herdr Fleet version below both unchanged surface choices

#### Scenario: A development build is rendered
- **WHEN** the page was compiled from a development revision
- **THEN** the footer retains its development and available commit identity

#### Scenario: Host selection or release availability changes
- **WHEN** the selected host changes or release discovery fails
- **THEN** the footer continues to show the same page build and both surface choices remain usable
