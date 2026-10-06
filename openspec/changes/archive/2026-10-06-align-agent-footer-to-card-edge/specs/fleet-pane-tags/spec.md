## MODIFIED Requirements

### Requirement: Named colored tags are visible and editable from native Agent rows
A tagged Agent rail row SHALL display an additional line below its current content with every assigned tag's name and color in assignment order. The tag badges SHALL share a reserved third-row footer with host/session metadata; badges SHALL precede the metadata in wrapping flow and metadata SHALL align to the right edge of the final line. No tag SHALL be reduced to color alone or hidden behind a count. Long lines SHALL wrap within the row. The tag line SHALL sit within the same painted row surface as the body, retain the leading content inset and end at the card's standard right content inset without reserving the two-line action column and use compact bottom padding. It SHALL remain a separate passive line rather than invoke Pane navigation. Untagged rows SHALL show no tag badges while retaining the third-row metadata baseline. The phone switcher SHALL use the same presentation. Rail badges SHALL use smaller text and color marks while keeping all names readable and wrapping within the text area. The compact tag-edit action SHALL sit below the star in the same trailing column on every device. Targets SHALL remain independent. Phone tag lines SHALL retain the desktop footer's full-width insets and text-to-tag gap. A keyboard- and touch-accessible control SHALL allow selecting, creating and removing associations without opening the pane or toggling its favorite. Global tag editing SHALL remain reachable from the rail and Fleet settings even when no agent is listed. Editing controls SHALL report loading, saving, conflict and failure states, and colors SHALL supplement readable text.

#### Scenario: A row has several tags
- **WHEN** the rail renders the tagged pane
- **THEN** a separate line below its existing content shows its named colored tags in order and wraps as needed

#### Scenario: The last association is removed
- **WHEN** the operator removes a pane's last tag
- **THEN** its tag badges disappear while the metadata footer remains and other panes using that tag are unchanged

#### Scenario: The operator edits from a phone or keyboard
- **WHEN** the operator opens the tag editor and changes assignments or a global definition
- **THEN** all controls are reachable, focus remains in the dialog and returns on close, and the pane navigation and favorite actions do not fire

#### Scenario: A tagged row changes its surface state
- **WHEN** a tagged row is selected, blocked, hovered or drawn as a card
- **THEN** its independent tag line remains inside the same background and border treatment with matching content insets

#### Scenario: Phone tags wrap below the action row
- **WHEN** a tagged Agent card is drawn on a phone
- **THEN** tag names wrap below the text within the same shared surface and insets as desktop cards, without covering either action
