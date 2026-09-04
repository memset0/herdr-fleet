## MODIFIED Requirements

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
