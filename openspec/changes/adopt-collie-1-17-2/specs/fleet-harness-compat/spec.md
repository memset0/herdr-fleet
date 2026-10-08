## REMOVED Requirements

### Requirement: Claude's background-work hint on the mode line is not a dialog key hint
**Reason**: Collie 1.15.2 reads Claude's own `esc to interrupt` and `↓ to manage` status hints
itself (`namesAModalKey`, #330), shared by the input-box locator and the adapter's modal scan, which
is the repair this temporary port made. The port is retired at the sync that adopts that release, as
the requirement itself provided. One difference is accepted: a notice Claude right-aligns after
`↓ to manage` on the same row is still read as a modal upstream, and is reported upstream rather than
ported.

**Migration**: None for operators. The fork-owned recogniser, its suite, its fixtures and both
`FORK.toml` entries are removed, and both Claude grammar call sites return to upstream's text.
