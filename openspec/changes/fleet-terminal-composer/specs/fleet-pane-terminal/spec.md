## ADDED Requirements

### Requirement: The terminal surface offers an optional input box that writes straight into the terminal
The terminal surface SHALL offer, in its own top row, a toggle that shows or hides an input box under
the terminal. While shown the box SHALL take layout space and the terminal SHALL refit to what is
left; it MUST NOT overlay the terminal. Whether the box is shown SHALL be remembered per browser, and
an absent, unreadable or inaccessible stored value SHALL mean hidden.

The box SHALL use Collie's composer field and look, and SHALL NOT use Collie's send pipeline. Sending
SHALL write the draft into the attached terminal as a paste — wrapped in bracketed-paste markers only
while the program has enabled bracketed paste, with line breaks sent as carriage returns and any
paste markers inside the text removed — in input frames of a bounded size, followed by Enter after a
pacing delay that grows with the text's size and is bounded. The delay SHALL be pacing only: nothing
SHALL be read back, verified, retried or timed out.

Send SHALL be disabled, and the draft kept, while the terminal is not connected and attached. The
draft SHALL be cleared only after every frame and the Enter were accepted by an open connection.
Ctrl+Enter or Cmd+Enter SHALL send and Enter SHALL insert a line break, as in Collie's composer.

Where the operator's device may not write, neither the toggle nor the box SHALL be offered.

#### Scenario: The operator shows the box
- **WHEN** the operator turns the toggle on
- **THEN** the box appears under the terminal, the terminal refits to the remaining space, and the choice is still in effect after a reload

#### Scenario: A send while attached
- **WHEN** the operator sends a draft while the terminal is attached
- **THEN** the text is written as a paste in bounded frames, Enter follows after the pacing delay, and the box is cleared

#### Scenario: The terminal is not connected
- **WHEN** the terminal is connecting, or its connection has closed
- **THEN** Send is disabled and the draft stays in the box

#### Scenario: A read-only device
- **WHEN** the device may not write
- **THEN** no toggle and no box are offered
