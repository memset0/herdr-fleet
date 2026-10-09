## MODIFIED Requirements

### Requirement: The boundary check runs on every change

The fork boundary check SHALL run in continuous integration on every change, not only when an
adoption is under way. It SHALL run from a workflow the fork owns, beside upstream's own, so
upstream's workflow stays upstream's text. A manifest is a porting guide for the next adoption, and one that drifted
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

## ADDED Requirements

### Requirement: The fork's own tooling stands beside upstream's files
Material that exists only for the fork SHALL live in files the fork owns whenever doing so leaves an
upstream file as upstream's text. In particular:

- a test case the fork adds for a port or for fork behavior SHALL live in a fork-owned test file;
  an upstream test file carries a fork edit only where one of upstream's own cases must change;
- a lint finding at a fork-owned parse boundary SHALL be suppressed at its line, with its reason,
  rather than by a block in upstream's lint configuration;
- the fork's TypeScript and test entrypoints SHALL extend upstream's configuration from a fork-owned
  file, and reach upstream's scripts only through an entry point that is already a declared port;
- the fork's own documentation SHALL live outside upstream's documentation directory, so upstream's
  checks over that directory need no exclusion.

#### Scenario: A fork case is added for a port
- **WHEN** a change adds a test for behavior the fork owns or for one of its ports
- **THEN** the case is written in a fork-owned test file, and the upstream test file beside it keeps upstream's text

#### Scenario: A fork parse boundary trips the typeof rule
- **WHEN** a fork-owned file narrows an untrusted parsed value with a runtime type check
- **THEN** that line carries the one rule's inline suppression with its reason, and upstream's lint configuration is unchanged

