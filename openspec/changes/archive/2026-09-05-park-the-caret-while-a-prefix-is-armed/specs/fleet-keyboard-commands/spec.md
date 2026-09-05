## MODIFIED Requirements

### Requirement: An armed prefix preempts text input, and direct chords always apply
While a prefix is armed, the recognizer SHALL receive the next key before any text-entry surface,
including the composer's draft field and its direct-typing mode. `Escape`, `Tab` and the arrow keys
SHALL resolve as second chords rather than as text input or as keys sent to a Pane. The moment the
sequence completes or cancels, that preemption SHALL end and the same keys SHALL again reach the
surface that owns them.

PREEMPTION SHALL EXTEND TO THE INPUT METHOD. An input method composes into the focused editable
element, and a key it has claimed for a composition reaches the page either not at all or without the
physical code a binding is matched on — so a capture-phase listener alone does not preempt it. While a
prefix is armed, Fleet SHALL therefore leave no editable element focused, so that the second chord
arrives as an ordinary key.

The caret SHALL be remembered when the prefix arms and SHALL be returned when the sequence ends, by
every exit: a completed command, `Escape`, an unregistered second chord, and the timeout. It SHALL
return to the offset it was taken from, except where the command that ran moved the operator to
another Pane, which keeps its existing rule.

Fleet MUST NOT do this while a composition is already in flight, because moving focus then would
commit or discard a partly-typed word. In that case the caret SHALL stay where it is and the sequence
SHALL proceed as it does today.

An unregistered second chord SHALL be lost rather than reaching the draft. This is a deliberate cost
of the preemption above: the key was typed at a moment when nothing editable held focus. Fleet MUST
NOT synthesise a replacement keystroke.

A surface opened by a prefix command SHALL return the caret to the composer when it closes, never to
the element the caret was parked on.

A direct chord SHALL be recognised in every focus context, including while the composer holds focus
and while direct-typing mode is armed.

No other Fleet surface SHALL install its own application-level key listener; a surface that needs a
key SHALL add a command to the catalog.

#### Scenario: Prefix arms while the composer has focus
- **WHEN** the operator presses the prefix with the caret in the composer and then presses a registered second chord
- **THEN** Fleet invokes that command and the composer's draft is unchanged

#### Scenario: Arrow key arrives during an armed prefix in direct-typing mode
- **WHEN** direct-typing mode is armed, the operator presses the prefix, and then presses an arrow key that is a registered second chord
- **THEN** Fleet invokes that command and sends no key to the Pane

#### Scenario: The same arrow key arrives with no prefix armed
- **WHEN** direct-typing mode is armed and the operator presses that arrow key without arming the prefix
- **THEN** the key reaches the Pane exactly as it does today and Fleet invokes nothing

#### Scenario: A direct chord arrives while typing
- **WHEN** the composer holds focus, or direct-typing mode is armed, and the operator presses a registered direct chord
- **THEN** Fleet invokes that command and prevents the chord's default

#### Scenario: A prefix sequence completes under an input method
- **WHEN** an input method is active, the caret is in the composer, and the operator presses the prefix and then a registered letter chord
- **THEN** Fleet invokes that command, no composition is begun, and the caret returns to the composer at the offset it left

#### Scenario: The sequence is abandoned
- **WHEN** the operator arms the prefix and presses nothing until it expires
- **THEN** the caret returns to the composer at its own offset without waiting for another key

#### Scenario: A composition is already in flight
- **WHEN** the operator arms the prefix while part-way through composing a word
- **THEN** the caret is not moved and the composition is neither committed nor discarded

#### Scenario: An unregistered second chord
- **WHEN** the operator arms the prefix and presses a key no binding claims
- **THEN** the sequence ends, no command runs, the caret returns to the composer, and that one character does not appear in the draft

#### Scenario: A prefix command opens a panel
- **WHEN** a prefix command opens a rename or a confirmation and that surface is then closed
- **THEN** the caret returns to the composer rather than to whatever held it while the prefix was armed

