## ADDED Requirements

### Requirement: Renaming is one surface, however it is reached
A rename SHALL be one component with one save, whether it is begun from a key or from the row-actions
menu. Both SHALL present the same panel in the same position, prefilled the same way, with the same
rules for a blank value — a Tab must be named; a Pane's blank clears its label — and the same
messages on success and refusal.

There SHALL NOT be a second surface in this fork for asking one line of text. A component with no
caller left is removed rather than kept, because a spelling that still exists is a spelling somebody
will reach for.

#### Scenario: The same rename is reached two ways
- **WHEN** the operator renames a Tab from the keyboard, and then renames one from the row-actions menu
- **THEN** the same panel opens in the same place, and one save runs in both cases

#### Scenario: A blank name is refused the same way from either route
- **WHEN** a Tab is given a blank name from the menu
- **THEN** it is refused in the panel exactly as it is from the keyboard, and nothing is sent

#### Scenario: The menu's other rows are unaffected
- **WHEN** the row-actions menu is opened
- **THEN** closing, focusing and the capability gates that hide unsupported rows behave exactly as before
