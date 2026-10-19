## ADDED Requirements

### Requirement: The phone waits out a slow repaint after a key
After the phone sends a key to a pane card, it SHALL wait for the pane's text to change for up to a fork-owned bound of several seconds, longer than Collie v1.22.6's 1.2 s. Reads SHALL keep upstream's first spacing and then continue at its last gap until the bound, and the wait SHALL end on the first read whose text differs from the baseline.

#### Scenario: A pane that repaints after several seconds
- **WHEN** a key's repaint lands a few seconds after the key, inside the bound
- **THEN** the wait sees it within one read gap and the card revalidates on the new picture

#### Scenario: A pane that repaints at once
- **WHEN** the first read already differs from the baseline
- **THEN** the wait ends on that read

#### Scenario: A key that changes nothing
- **WHEN** no read differs before the bound
- **THEN** the wait ends at the bound and reports no change
