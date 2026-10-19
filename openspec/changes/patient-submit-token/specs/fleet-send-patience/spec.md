## ADDED Requirements

### Requirement: A key token outlives a slow record write
The key gate's token lifetime SHALL be a fork-owned bound of a few seconds, longer than Collie v1.22.6's 150 ms, so that recording `submit-sent` on a slow filesystem between minting the token and pressing the submit key does not leave a verified send in the box. A token SHALL still be spent by its first commit, refused once the pane's gate revision moved after its read, and refused after the bound.

#### Scenario: A slow record write before the submit key
- **WHEN** the `submit-sent` record takes a few hundred milliseconds to write
- **THEN** the submit key is still pressed and the send goes on to S2

#### Scenario: A person's key between S1 and the commit
- **WHEN** a key reaches the pane through the gate after S1's read and before the commit
- **THEN** the commit is refused `stale_surface` and no submit key is pressed

#### Scenario: A token past the bound
- **WHEN** more than the bound passes between mint and commit
- **THEN** the commit is refused `stale_token` and no submit key is pressed
