## ADDED Requirements

### Requirement: The Pane page's strips inherit the row-actions stand

The tab strip's and the pane strip's own row actions SHALL be presented by the same rule the
hierarchy's are, and SHALL define nothing of their own to achieve it. Fleet MUST NOT add a menu, a
dialog, a gesture, or a placement to either strip: they already open the same two actions sheets,
so the stand arrives with the sheet.

#### Scenario: Operator right-clicks a tab in the strip

- **WHEN** the operator opens a tab's actions from the strip with a mouse's context gesture
- **THEN** Collie's Tab actions are presented at the cursor, with the same rows, gating and writes the bottom sheet shows

#### Scenario: The strips on a touch device

- **WHEN** the operator long-presses a tab or a pane in the strips
- **THEN** the existing bottom sheet is presented, unchanged
