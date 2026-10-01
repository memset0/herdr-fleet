## ADDED Requirements

### Requirement: The Gateway forwards Collie's seen signal
Among the request headers it allowlists for Collie, the Gateway SHALL forward Collie's seen header
(`x-collie-seen`) unchanged. The header carries no credential and no identity; it is the signal by
which Collie's own page tells Collie that a pane read is the operator looking at the pane, and
Collie accepts it as proof that the read came from its own page. Forwarding it SHALL NOT forward any
other header outside the allowlist.

#### Scenario: A pane read marked as seen passes the Gateway
- **WHEN** an authenticated browser reads a pane through the public origin with Collie's seen header
- **THEN** Collie receives the read with the seen header and records the pane as seen

#### Scenario: A read without the header stays a plain read
- **WHEN** an authenticated browser reads a pane through the public origin without the seen header
- **THEN** Collie receives no seen header and the pane's seen state is unchanged
