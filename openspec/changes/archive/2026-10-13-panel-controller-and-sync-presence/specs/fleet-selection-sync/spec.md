## ADDED Requirements

### Requirement: Active participation uses expiring tab leases
The authenticated lead SHALL track transient tab participation through heartbeats. Only visible joined ordinary tabs SHALL renew an active lease. Leaving, hiding or closing SHALL withdraw participation when possible; missed heartbeats SHALL expire within fifteen seconds. Reordered older heartbeats SHALL NOT undo a newer withdrawal. Leases SHALL be scoped to authenticated sessions, counts SHALL exclude the requesting tab, and responses SHALL expose no participant identifiers. Presence writes SHALL enforce the existing exact-origin gate and bounded validated bodies. Restart SHALL clear presence and visible viewers SHALL register again without changing the central selection.

#### Scenario: A tab leaves or stops responding
- **WHEN** a tab leaves, becomes hidden, closes or stops sending heartbeats
- **THEN** its active lease is withdrawn or expires, and receiver counts decrease without a selection mutation
