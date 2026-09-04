## ADDED Requirements

### Requirement: Every question the keyboard asks is the same surface
When a command needs one line of input — a name, an answer — it SHALL ask through one shared prompt
panel rather than through a surface of its own. That panel SHALL own: the position and ground the
command bar uses, a heading naming what is being asked with an optional line under it saying what it
costs, an input that takes focus with its initial value selected, submission on `Enter`, cancellation
on `Escape` and on dismissal, and one reserved line beneath that carries a hint or a refusal without
changing the panel's size.

A caller SHALL own only what is genuinely its own: what a submission means, and what an empty value
means for its target.

A confirmation SHALL name its default answer in the HEADING, beside the question it qualifies, rather
than beside the field — a marker in front of an input reads as part of what is being typed.

#### Scenario: Two surfaces ask the same way
- **WHEN** the rename input and the close confirmation are opened
- **THEN** both present the same panel, heading, focused-and-selected field, footer line, and the same response to `Enter` and `Escape`

#### Scenario: A confirmation says what Enter will do
- **WHEN** a confirmation opens
- **THEN** its heading carries the question and the `y/N` that names the default, and nothing sits between the field and its own text

#### Scenario: A refusal appears
- **WHEN** a caller reports a validation error or a refused mutation
- **THEN** the reserved line shows it and the panel does not change size
