## REMOVED Requirements

### Requirement: Codex's headless multi-item status row is read as a status row
**Reason**: The owner decided, for the Collie `v1.22.6` adoption, that Codex and Claude Code panes are
read by the adopted upstream readers as shipped. Upstream's Codex profile reworked the status-row
reading in 1.20.2 and 1.22.0 (painted separator gaps, the `← for agents` tail, hidden hint rows), and
the fork's temporary exemption is retired with this adoption rather than re-applied on top of it.

**Migration**: None for operators. A Codex screen that upstream's reader does not read is reported
with its captured rows and the receipt's reason, for the owner's decision; no fork exemption replaces
it in this change.
