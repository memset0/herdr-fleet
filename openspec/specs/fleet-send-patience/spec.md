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

### Requirement: A probe character that lands late is removed
After a probe whose character did not show within the probe window, the protocol SHALL keep reading for one more probe window. When a read shows the box holding S0's text plus exactly one probe character, and nothing else at the box changed (no modal, no stronger cue, the same rows under the box, or on a pane without a frame exactly one row changed by the probe character alone), the protocol SHALL send one Backspace through the key gate and read until the probe character count is back to S0's. The refusal SHALL stay `probe_failed`, and its detail SHALL say whether the box is clean again. Any other screen SHALL get no key, and Escape SHALL never be sent.

#### Scenario: The probe character arrives after the probe gave up
- **WHEN** the probe window passes with the box unchanged, and the probe character then appears alone in the box
- **THEN** one Backspace goes through the gate, the box reads as at S0, and the refusal's detail says the box is clean again

#### Scenario: Something else lands instead
- **WHEN** the box gains text other than exactly the probe character after the probe gave up
- **THEN** no key is sent and the detail says a probe character may remain

#### Scenario: Nothing arrives
- **WHEN** the extra window passes with the box unchanged
- **THEN** no key is sent and the detail says a probe character may remain

### Requirement: A lone probe character is not a person's draft
At S0 of a send, a command or an Add-to-it, a found input box whose whole content is one probe character, with no modal over it, SHALL be treated as Collie's own debris rather than a draft: the protocol SHALL send one Backspace through the key gate, read until the box is empty, read S0 again, and continue the request from that S0. When the box does not empty, the request SHALL be refused `probe_failed` without any further key. A box holding anything besides the lone probe character SHALL keep the existing `draft_present` refusal and receive no key.

#### Scenario: Debris from an earlier send
- **WHEN** a send arrives and the box holds only the probe character
- **THEN** one Backspace clears it and the send goes out with only its own text

#### Scenario: Add to a box holding only debris
- **WHEN** Add to it arrives and the box holds only the probe character
- **THEN** the box is cleared first and the probe character is not part of what is sent

#### Scenario: A real draft next to a probe character
- **WHEN** the box holds the probe character and other text
- **THEN** the send is refused `draft_present` and no key is sent

### Requirement: Callers wait at least as long as a send may take
The phone's request for a Send Protocol send (on a local pane, or through the reply route of a crew member's pane) SHALL allow longer than the lead's forward of that reply route, and the lead's forward of a member's reply route SHALL allow longer than the Send Protocol's lock bound. Other forwarded writes and other phone mutations SHALL keep their existing budgets.

#### Scenario: A slow send on a member's pane
- **WHEN** a member takes most of its lock bound to answer a send
- **THEN** the lead still relays the member's answer and the phone still receives it

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
