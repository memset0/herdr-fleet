# fleet-send-patience Specification

## Purpose
Keep the Send Protocol usable on panes that redraw slowly: give every step room to see the pane react, never leave Collie's own probe character behind in the box, and keep every caller waiting on a send patient enough to receive its answer.

## Requirements

### Requirement: Send steps allow slow panes without slowing fast ones
Fleet SHALL bound the Send Protocol's S0, probe, S1, S2 and notice steps with windows several times longer than Collie v1.22.6's, as plain constants, and the per-pane lock bound SHALL be their sum as upstream defines it. Within a step, the gap between two reads SHALL never exceed a fixed cap of a fraction of a second, and a step SHALL end as soon as a read decides it. A longer window SHALL only cost time when a step does not pass.

#### Scenario: A pane that redraws after several seconds
- **WHEN** the probe character appears in the box several seconds after it was written, inside the probe window
- **THEN** the probe passes and the send continues

#### Scenario: A pane that redraws at once
- **WHEN** the box shows the probe character on the first read
- **THEN** the probe step ends on that read, without waiting out its window

#### Scenario: Late in a long step
- **WHEN** a step's verdict becomes available late in its window
- **THEN** it is read within one capped gap of becoming available

### Requirement: Callers wait at least as long as a send may take
The send's total deadline SHALL account for all enabled read windows, permitted retries, cleanup and measured write costs. A longer window MUST NOT impose a fixed delay once the screen provides decisive evidence.

The phone's request for a Send Protocol send (on a local pane, or through the reply route of a crew member's pane) SHALL allow longer than the lead's forward of that reply route, and the lead's forward of a member's reply route SHALL allow longer than the Send Protocol's full possible duration. Other forwarded writes and other phone mutations SHALL keep their existing budgets.

#### Scenario: A slow send on a member's pane
- **WHEN** a member takes most of its lock bound to answer a send
- **THEN** the lead still relays the member's answer and the phone still receives it

#### Scenario: Upstream adds a late-probe recovery window
- **WHEN** a send consumes that window or its permitted retry in addition to ordinary steps and write costs
- **THEN** neither caller abandons it before its full bounded result, and no caller silently replays an uncertain send

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
