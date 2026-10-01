## MODIFIED Requirements

### Requirement: Collie's release history is retained accumulatively

`COLLIE_CHANGELOG.md` SHALL hold Collie's release history under its own name so that no entry of
Collie's is read as a release of this product's. Upstream does not only append to its changelog — it
has rewritten and truncated it — so retaining that file byte-for-byte and retaining Collie's history
are different things, and this repository SHALL do the second.

The adopted release's changelog SHALL appear verbatim at the top of the file, and SHALL remain a
byte-exact prefix of it, so the retention stays checkable rather than asserted. Entries upstream has
since dropped SHALL be kept below it word-for-word, and SHALL NOT be reordered, reformatted, or
merged into the upstream text. One marker line at the seam SHALL say that upstream truncated its own
file and that what follows is retained from an earlier adoption, so a reader is never shown a
continuous history upstream did not write.

An entry is dropped when the adopted changelog no longer carries it: its release heading is gone, or
the entry is gone from under a heading upstream still carries. An entry upstream rewrote in place —
the same release, the same commits, reworded — is upstream's correction of its own record, not a
dropped entry; the adopted wording replaces the earlier one and nothing is retained below the seam
for it. The adoption that meets such a rewrite SHALL name it in its own design so the replacement is
a recorded decision rather than an unnoticed one.

Nothing of this product's SHALL be written into that file, and Collie's entries SHALL NOT be written
into this product's changelog.

#### Scenario: An adoption brings a rewritten upstream changelog
- **WHEN** the adopted release's changelog no longer contains entries the retained file has
- **THEN** the adopted text goes on top verbatim and the dropped entries are retained below it, unedited

#### Scenario: Upstream corrects an entry in place
- **WHEN** the adopted changelog carries every retained release heading and entry, one of them reworded under the same release and commits
- **THEN** the adopted text replaces the file with no seam, and the adoption's design names the reworded entry

#### Scenario: The retention is checked
- **WHEN** the boundary check runs
- **THEN** it fails unless the adopted release's changelog is a byte-exact prefix of the retained file

#### Scenario: A reader opens the retained file
- **WHEN** the file contains text from more than one adoption
- **THEN** a marker line at the seam says where upstream truncated and that what follows is retained
