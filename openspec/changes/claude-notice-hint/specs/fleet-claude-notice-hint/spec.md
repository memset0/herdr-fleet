## ADDED Requirements

### Requirement: A right-aligned notice under Claude's box is a hint
Fleet SHALL load the Claude profile with a hint under the box matching a row that holds only a right-aligned notice (at least 20 leading spaces, then ✔, ✗ or ⚠), so that such a row is left out of the count of rows under the box.

#### Scenario: The notice joins the hint row once the box holds text
- **WHEN** a send goes into a running Claude turn whose notice row merges into the hint row at the probe's character
- **THEN** the probe passes and the send goes in

#### Scenario: A list under the box
- **WHEN** a left-aligned list or dialog appears under the box at the probe's character
- **THEN** it is counted and the probe still fails
