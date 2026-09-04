## MODIFIED Requirements

### Requirement: The Pane page's strips inherit the row-actions stand

The tab strip's and the pane strip's own row actions SHALL be answered by the same pair of surfaces
the hierarchy uses, chosen the same way, and SHALL define nothing of their own to achieve it. Each
strip MAY name a drop-in that takes the actions sheet's own props and renders that sheet unless the
menu was chosen; it MUST NOT gain a menu, a prompt, a gesture, or a placement of its own.

#### Scenario: Operator right-clicks a tab in the strip

- **WHEN** the operator opens a tab's actions from the strip with a mouse's context gesture
- **THEN** the fork's menu is presented at the cursor, with the same rows, gating and writes the bottom sheet shows

#### Scenario: The strips on a touch device

- **WHEN** the operator long-presses a tab or a pane in the strips
- **THEN** Collie's bottom sheet is presented, unchanged
