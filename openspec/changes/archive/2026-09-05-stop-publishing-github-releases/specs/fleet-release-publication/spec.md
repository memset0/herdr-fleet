## Purpose

Governs what cutting a release does in this product: that a version is marked by a tag, and that
publishing a GitHub Release is never something the repository does on its own.

## ADDED Requirements

### Requirement: A pushed tag MUST NOT publish anything
Herdr Fleet SHALL NOT publish a GitHub Release as a consequence of any push. No repository automation
MAY create, draft, or upload assets to a Release in response to a pushed tag, branch, or commit.

The repository MAY retain the machinery that builds release payloads, provided it runs only when a
person invokes it deliberately. An agent working in this repository MUST NOT invoke it, and MUST NOT
create a Release by any other means.

#### Scenario: A release tag reaches the remote
- **WHEN** a `vX.Y.Z` tag is pushed
- **THEN** no GitHub Release is created and no assets are uploaded

#### Scenario: An upstream tag reaches the remote by accident
- **WHEN** a tag from the upstream project is pushed to this remote
- **THEN** it likewise publishes nothing, so the mistake stays a stray ref rather than becoming a release under this product's name

#### Scenario: An agent is asked to ship a version
- **WHEN** an agent cuts and pushes a release
- **THEN** it stops at the commit and the tag, and does not publish a Release

### Requirement: A release is still marked by a tag
Cutting a release SHALL still produce and push one annotated `vX.Y.Z` tag, and the repository's
existing tag check SHALL keep reporting a cut version that has none.

A tag here means the version exists in this history at a known commit. It is not a publication, and
the absence of a Release MUST NOT be treated as a release that failed to ship.

#### Scenario: A release is cut
- **WHEN** the release commit is pushed
- **THEN** its annotated tag is pushed with it, named explicitly rather than swept up by a push option

#### Scenario: A cut version has no tag
- **WHEN** the tag check runs over a release commit whose tag was never cut
- **THEN** it still reports the missing tag

### Requirement: Installing and updating do not depend on this product's Releases
Herdr Fleet SHALL keep its install and update paths independent of Releases published from this
repository. A change that would make the product read its own Releases MUST restore a way to publish
them, or it MUST NOT be made.

#### Scenario: The operator updates a Herdr-managed install
- **WHEN** the operator updates this product
- **THEN** the update runs through the Herdr plugin action and reads nothing from this repository's Releases

#### Scenario: The in-app update check runs
- **WHEN** the bridge checks whether a newer version exists
- **THEN** it reads the upstream project's repository, which this product does not publish to, and the absence of Releases here changes nothing about it
