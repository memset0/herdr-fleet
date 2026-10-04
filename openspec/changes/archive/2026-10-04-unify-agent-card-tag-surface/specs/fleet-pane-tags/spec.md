## MODIFIED Requirements

### Requirement: Named colored tags are visible and editable from native Agent rows
A tagged Agent rail row SHALL display an additional line below its current content with every assigned tag's name and color in assignment order. No tag SHALL be reduced to color alone or hidden behind a count. Long lines SHALL wrap within the row. The tag line SHALL sit within the same painted row surface as the body, align with its leading and trailing text insets and use compact bottom padding. It SHALL remain a separate passive line rather than invoke Pane navigation. Untagged rows SHALL reserve no tag-line space. The phone switcher SHALL use the same presentation. Rail badges SHALL use smaller text and color marks while keeping all names readable and wrapping within the text area. The compact tag-edit action SHALL stay below the star in a fixed trailing column, with enlarged independent targets for coarse pointers. A keyboard- and touch-accessible control SHALL allow selecting, creating and removing associations without opening the pane or toggling its favorite. Global tag editing SHALL remain reachable from the rail and Fleet settings even when no agent is listed. Editing controls SHALL report loading, saving, conflict and failure states, and colors SHALL supplement readable text.

#### Scenario: A row has several tags
- **WHEN** the rail renders the tagged pane
- **THEN** a separate line below its existing content shows its named colored tags in order and wraps as needed

#### Scenario: The last association is removed
- **WHEN** the operator removes a pane's last tag
- **THEN** its extra line disappears and other panes using that tag are unchanged

#### Scenario: The operator edits from a phone or keyboard
- **WHEN** the operator opens the tag editor and changes assignments or a global definition
- **THEN** all controls are reachable, focus remains in the dialog and returns on close, and the pane navigation and favorite actions do not fire

#### Scenario: A tagged row changes its surface state
- **WHEN** a tagged row is selected, blocked, hovered or drawn as a card
- **THEN** its independent tag line remains inside the same background and border treatment with matching content insets
