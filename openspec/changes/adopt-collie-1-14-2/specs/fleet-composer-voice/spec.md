## MODIFIED Requirements

### Requirement: The microphone is a control of its own, not a state of the send control
Herdr Fleet SHALL draw the composer's record control and its send control as two separate controls
inside the composer's one draft box, and MUST NOT decide which of the two is drawn from whether the
draft is empty or holds attachments. The record control SHALL be drawn on exactly the condition that
decides the feature exists at all — a provider published by the bridge and a browser that can record
— and SHALL be absent, not disabled, when that condition does not hold. Within the box it SHALL stand
after the field and the attach control and directly lead the send control, at the box's own control
size and touch target.

Both controls MUST keep the behavior they had as one shared slot: the record control starts a clip,
ends a clip and carries the bridge's own reason when the provider cannot serve; the send control
sends, and answers the destructive-input and override confirmations where those are armed.

#### Scenario: Operator has written a draft and wants to dictate the next clause
- **WHEN** the draft holds text and the bridge publishes a usable provider
- **THEN** both the record control and the send control are drawn, and the record control starts a clip

#### Scenario: Operator has attached a file and wants to dictate the message
- **WHEN** the draft holds only attachments and the bridge publishes a usable provider
- **THEN** both controls are drawn, and both accept

#### Scenario: Operator dictates in turns
- **WHEN** a transcript has landed in the draft and the operator starts a further clip
- **THEN** the clip is recorded and its transcript joins the same draft, with no limit on how many times this repeats

#### Scenario: The installation has no speech provider
- **WHEN** the bridge publishes no provider, or the browser cannot record
- **THEN** no record control is drawn and the send control is the box's only control after attach

#### Scenario: The provider is configured but cannot serve
- **WHEN** the bridge publishes a provider that reports itself unavailable
- **THEN** the record control is drawn, refuses activation, and carries the bridge's own reason

### Requirement: A blank draft forbids sending
Herdr Fleet SHALL refuse to send a draft that holds nothing but whitespace and no attachment, and the
send control MUST show that refusal rather than accepting an activation that does nothing. A draft
that holds an attachment is not blank, whatever its text, because the adopted Collie sends the
attachment's path.

The refusal itself is unchanged Collie behavior; what changes is that it becomes visible, because the
record control no longer stands in front of the send control on an empty draft.

#### Scenario: Operator looks at an empty composer
- **WHEN** the draft is empty or holds only whitespace, and no attachment
- **THEN** the send control shows that it will not send

#### Scenario: Operator types the first character
- **WHEN** the draft gains a non-whitespace character
- **THEN** the send control accepts

#### Scenario: Operator attaches a file to an empty draft
- **WHEN** the draft holds no text and one attachment
- **THEN** the send control accepts

#### Scenario: The composer is armed for direct typing
- **WHEN** the composer is typing into the terminal directly
- **THEN** the trailing control remains the one that ends that mode, and the draft's contents do not decide whether it may be activated
