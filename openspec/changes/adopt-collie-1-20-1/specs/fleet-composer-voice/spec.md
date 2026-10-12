## ADDED Requirements

### Requirement: A clip ends only when the operator ends it
While a clip is being recorded, Herdr Fleet SHALL draw the adopted Collie's recorder bar over the
composer, with its finish control standing where the record control stood. In a Fleet build the
recorder MUST NOT finish a clip because the operator stopped speaking: no quiet countdown SHALL be
drawn and no silence SHALL stop or transcribe the clip. A clip SHALL end only when the operator
activates the finish control (or a binding that does the same), discards the clip, or the adopted
Collie's own recording limit is reached.

Upstream finishes a clip after two seconds of quiet once speech was heard. The operator dictates in
turns and pauses to think mid-sentence, so a pause that sends half a thought for transcription is
the failure this requirement removes. What happens to a finished clip's transcript, hands-free
sending included, is the adopted Collie's and is unchanged.

#### Scenario: The operator pauses mid-dictation
- **WHEN** a clip is recording in a Fleet build, speech has been heard, and the room stays quiet for longer than upstream's countdown
- **THEN** the clip keeps recording, no countdown is drawn, and nothing is transcribed

#### Scenario: The operator finishes the clip
- **WHEN** a clip is recording in a Fleet build and the operator activates the finish control
- **THEN** the clip stops and is transcribed exactly as the adopted Collie does

#### Scenario: The operator discards the clip
- **WHEN** a clip is recording in a Fleet build and the operator activates the discard control
- **THEN** the clip is thrown away and nothing is transcribed

#### Scenario: A bundle built without the Fleet statement
- **WHEN** the web application is built without the Fleet build statement
- **THEN** the recorder bar finishes on silence exactly as the adopted Collie does

## MODIFIED Requirements

### Requirement: The microphone is a control of its own, not a state of the send control
Herdr Fleet SHALL draw the composer's record control and its send control as two separate controls
inside the composer's one draft box, and MUST NOT decide which of the two is drawn from whether the
draft is empty or holds attachments. The record control SHALL be drawn on exactly the condition that
decides the feature exists at all — a provider published by the bridge and a browser that can record
— and SHALL be absent, not disabled, when that condition does not hold. Within the box it SHALL stand
after the field and the attach control and directly lead the send control, at the box's own control
size and touch target.

Where the adopted Collie's left-hand layout turns the pane screen round, the box's controls SHALL
mirror with it: the record control SHALL stay directly beside the send control, on the field's side
of it, and the attach control on the field's side of the record control, so the two controls the
thumb reaches for stay together at the box's outer edge in either hand. The tab order SHALL be the
one upstream's layout gives, unchanged by the mirroring.

Both controls MUST keep the behavior they had as one shared slot: the record control starts a clip
and carries the bridge's own reason when the provider cannot serve; the send control sends, and
answers the destructive-input and override confirmations where those are armed. Since Collie 1.20 a
running clip is shown by the adopted recorder bar, which covers the composer and stands its finish
control on the record control's own place, so the clip is ended from the spot that started it.

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

#### Scenario: The operator chooses the left-hand layout
- **WHEN** the device's hand setting is left and the bridge publishes a usable provider
- **THEN** the send control stands at the box's outer left edge, the record control directly beside it toward the field, and both remain separate controls
