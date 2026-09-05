## ADDED Requirements

### Requirement: The keyboard hands the caret back to the composer
A Fleet command SHALL leave the operator able to keep typing. After an invocation completes, whether
it succeeded or failed, Fleet SHALL place the text caret in the current Pane's composer.

Where the caret lands SHALL be decided by where it was when the invocation began and by whether the
command moved the operator:

- If the composer held the caret when the invocation began, and the command did not move the
  operator to a different Pane, the caret SHALL return to the same offset it was taken from, clamped
  to the draft's current length.
- If the composer did not hold the caret, the caret SHALL land at the END of the composer.
- If the command moved the operator to a different Pane, Tab or Space, the caret SHALL land at the
  END of the composer regardless of the offset it began at, because the draft that offset described
  is no longer on screen.

The return SHALL settle rather than fire once: a composer that does not yet exist, or that cannot
take the caret, SHALL be waited for over a bounded window rather than skipped.

The return SHALL NOT take the caret from the operator. While the caret is already in the composer,
Fleet SHALL leave its offset alone, so an operator who resumed typing inside the settling window is
never interrupted.

A Fleet panel SHALL outrank the return. While any Fleet panel stands — the command bar, a rename, a
confirmation — that surface owns the caret and Fleet SHALL make no attempt to move it. When such a
panel closes, Fleet SHALL return the caret to whatever held it before the panel opened; if nothing
did, or that element is no longer on screen, the caret SHALL land at the end of the composer.

Opening a Fleet panel SHALL NOT trigger a return, because the panel's own field is where the caret
is meant to be.

#### Scenario: A command is invoked while the operator is writing
- **WHEN** the operator is typing mid-draft and completes a binding for a command that does not move them
- **THEN** the caret is back in the composer at the same offset once the command has run

#### Scenario: A command is invoked with the caret nowhere
- **WHEN** the operator completes a binding while nothing holds the caret
- **THEN** the caret lands at the end of the current Pane's composer

#### Scenario: A command moves the operator to another Pane
- **WHEN** a command creates a Tab, switches Pane, or closes the one the operator was on
- **THEN** the caret lands at the end of the composer that Pane presents, once it is on screen

#### Scenario: The command failed
- **WHEN** a command's action throws or is refused
- **THEN** the caret is returned exactly as it would have been had the command succeeded

#### Scenario: The operator gets there first
- **WHEN** the operator focuses the composer themselves before the return has settled
- **THEN** Fleet leaves the caret where the operator put it

#### Scenario: A panel is standing
- **WHEN** a command opens the command bar, a rename or a confirmation
- **THEN** the caret stays in that panel's own field and Fleet moves nothing

#### Scenario: A panel closes with nowhere to hand the caret back to
- **WHEN** a panel opened by a shortcut closes, and the element that held the caret before it opened is gone or was never there
- **THEN** the caret lands at the end of the composer rather than on the page body
