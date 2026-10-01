## ADDED Requirements

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
