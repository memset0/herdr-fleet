## ADDED Requirements

### Requirement: A menu acts on the first activation; the sheet is the surface that asks again

The fork's context menu SHALL perform a destructive verb on the FIRST activation of its row, and MUST
NOT arm and ask a second time. It does not exist until a deliberate secondary click has been made, it
stands beside the pointer rather than under it, and reaching one of its rows requires travelling to
it and pressing again — the two deliberate acts a second tap would be standing in for.

Collie's bottom sheet SHALL keep its own confirmation exactly as upstream wrote it, including the
blast radius it names before closing a Tab, on every device that gets it. The two surfaces MAY differ
here because the gesture that reaches them differs; they MUST NOT differ in what the act does.

The refusals that decide whether the verb exists at all — the multiplexer capability, the read-only
refusal, the host write block — apply to both surfaces unchanged. They are not confirmations, and
nothing here relaxes them.

#### Scenario: Operator closes from the menu

- **WHEN** the operator activates a destructive row in the menu
- **THEN** the act runs immediately, with no armed state and no second ask

#### Scenario: Operator closes from the sheet

- **WHEN** the operator activates the same row in the bottom sheet
- **THEN** it arms and asks again, naming what closing costs, exactly as it does upstream

#### Scenario: The device may not write

- **WHEN** the device is not authorised, the multiplexer cannot perform the verb, or the host is refusing writes
- **THEN** neither surface offers the verb, whichever one was chosen
