## MODIFIED Requirements

### Requirement: An adoption is merged as real ancestry

An adoption SHALL be a merge commit whose second parent is exactly the commit the selected tag
dereferences to. It MUST NOT be squashed, rebased, or replayed as cherry-picks. The ancestry is what
makes the *next* adoption a three-way merge with a real merge base; a fork that flattens one adoption
has to hand-port every one after it.

The merge SHALL be made on the branch this repository develops on, and SHALL NOT be pushed until the
boundary check, every entry's declared verification, and the repository's own lint, typecheck, test,
and version gates have passed. Pushing an adoption names the branch and this product's own tag;
upstream's tags arrive with the fetch and stay local, as `fleet-release-publication` requires of any
tag that is not this product's.

This repository's part in an adoption ends at the push of the release that carries it — the release
commit and its tag, not the merge alone. What that release must prove on a machine before it is
trusted is not this repository's to state, and a push is not by itself a completed adoption.

#### Scenario: An adoption is committed
- **WHEN** the merge is created
- **THEN** its second parent is exactly the dereferenced commit of the adopted tag

#### Scenario: An adoption is flattened
- **WHEN** an adoption would be squashed, rebased, or replayed as cherry-picks
- **THEN** it is rejected, because the next adoption would lose its merge base

#### Scenario: Gates have not passed
- **WHEN** the boundary check, entry verifications, or repository gates have not all passed
- **THEN** the adoption is not pushed

#### Scenario: The adoption is pushed
- **WHEN** the merge and the release that carries it reach the remote
- **THEN** the push names the branch and this product's tag, and the upstream tags fetched alongside them stay local

#### Scenario: A push is mistaken for completion
- **WHEN** the release has been pushed and nothing has run it
- **THEN** the adoption is not complete, and this repository does not report it as complete

## ADDED Requirements

### Requirement: An adoption is released, and the release is at least a MINOR

An adoption SHALL cut a release of this product, in the same change as the merge and by the release
recipe this repository already follows: one `chore(release)` commit that moves the three version
files and the newest numbered changelog heading and does nothing else, then one annotated tag,
publishing nothing.

The axis SHALL be at least MINOR. This product's number states how far a change has to travel, and an
adoption replaces what every member executes, so every member must redeploy before the fleet is
consistent again. A PATCH says the opposite — that levelling the lead is enough — and for an adoption
that is never true. A MAJOR remains the owner's to cut by hand: an agent that believes the sum sits
on that axis stops and says so rather than softening it into a MINOR.

`UPSTREAM.md` SHALL record the correspondence between the release this cuts and the Collie release it
adopts. That row is provenance and not a version component: it says which Collie this product's
number currently corresponds to, and never makes Collie's number part of ours.

#### Scenario: An adoption reaches its gates
- **WHEN** every port has been reviewed and every gate has passed
- **THEN** the same change cuts a release whose axis is at least MINOR, and tags it

#### Scenario: An adoption is proposed as a patch
- **WHEN** an adoption's changes look small enough to call a PATCH
- **THEN** the axis is still at least MINOR, because every member redeploys regardless of how the diff reads

#### Scenario: The sum sits on the major axis
- **WHEN** an adoption carries a broken contract, a renamed configuration key, or an operator step that changes
- **THEN** the agent stops and says so, and does not cut the release itself

#### Scenario: The correspondence is recorded
- **WHEN** the release is cut
- **THEN** `UPSTREAM.md` gains the row pairing it with the adopted Collie release, and this product's number claims nothing about Collie's
