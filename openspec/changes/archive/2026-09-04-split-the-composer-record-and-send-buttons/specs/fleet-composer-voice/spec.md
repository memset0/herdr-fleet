## Purpose

Governs how the composer ranks its voice control against its send control: that a draft can be
dictated in turns rather than once, and what a live clip forbids while it runs.

## ADDED Requirements

### Requirement: The microphone is a control of its own, not a state of the send control
Herdr Fleet SHALL draw the composer's record control and its send control as two separate controls in
the draft row, and MUST NOT decide which of the two is drawn from whether the draft is empty. The
record control SHALL be drawn on exactly the condition that decides the feature exists at all — a
provider published by the bridge and a browser that can record — and SHALL be absent, not disabled,
when that condition does not hold. It SHALL lead the send control in the row.

Both controls MUST keep the behavior they had as one shared slot: the record control starts a clip,
ends a clip and carries the bridge's own reason when the provider cannot serve; the send control
sends, and answers the destructive-input and override confirmations where those are armed.

#### Scenario: Operator has written a draft and wants to dictate the next clause
- **WHEN** the draft holds text and the bridge publishes a usable provider
- **THEN** both the record control and the send control are drawn, and the record control starts a clip

#### Scenario: Operator dictates in turns
- **WHEN** a transcript has landed in the draft and the operator starts a further clip
- **THEN** the clip is recorded and its transcript joins the same draft, with no limit on how many times this repeats

#### Scenario: The installation has no speech provider
- **WHEN** the bridge publishes no provider, or the browser cannot record
- **THEN** no record control is drawn and the send control is the row's only trailing control

#### Scenario: The provider is configured but cannot serve
- **WHEN** the bridge publishes a provider that reports itself unavailable
- **THEN** the record control is drawn, refuses activation, and carries the bridge's own reason

### Requirement: A live clip forbids sending
While a clip is being recorded or transcribed, Herdr Fleet SHALL refuse to send the draft, on every
path that reaches a send including the keyboard's. The refusal MUST be visible on the send control
rather than only enforced when it is activated.

This was structural while the two controls shared one slot — there was no send control during a clip
— and separating them removes that guarantee. A draft sent mid-clip would be sent without the words
still being dictated into it, and the transcript would then land in a draft the operator had already
given away.

#### Scenario: Operator tries to send during a recording
- **WHEN** a clip is being recorded or transcribed
- **THEN** the send control refuses, and shows that it refuses

#### Scenario: Operator tries to send during a recording from the keyboard
- **WHEN** a clip is being recorded or transcribed and the operator uses the keyboard's send binding
- **THEN** nothing is sent

#### Scenario: The clip ends
- **WHEN** the transcript has landed or the clip has been discarded
- **THEN** the send control accepts again, subject to the draft's own contents

### Requirement: A blank draft forbids sending
Herdr Fleet SHALL refuse to send a draft that holds nothing but whitespace, and the send control MUST
show that refusal rather than accepting an activation that does nothing.

The refusal itself is unchanged Collie behavior; what changes is that it becomes visible, because the
record control no longer stands in front of the send control on an empty draft.

#### Scenario: Operator looks at an empty composer
- **WHEN** the draft is empty or holds only whitespace
- **THEN** the send control shows that it will not send

#### Scenario: Operator types the first character
- **WHEN** the draft gains a non-whitespace character
- **THEN** the send control accepts

#### Scenario: The composer is armed for direct typing
- **WHEN** the composer is typing into the terminal directly
- **THEN** the trailing control remains the one that ends that mode, and the draft's contents do not decide whether it may be activated
