# fleet-pane-tags Specification

## Purpose

Provide shared colored labels for panes, maintained on the lead and available consistently across browsers without changing agent sessions or local favorites.

## Requirements

### Requirement: Tags belong to pane places and are shared by the lead
Fleet SHALL persist a global tag catalog and pane associations on the lead. An association SHALL use the same host, multiplexer session, pane identity and workspace-name guard as native pins, not agent implementation or conversation identity. Temporary absence SHALL NOT remove associations. Favorites SHALL remain unchanged and browser-local.

#### Scenario: An agent is replaced in a pane
- **WHEN** another agent or conversation occupies the same pane in the same workspace
- **THEN** its tags remain attached

#### Scenario: A pane identity is reused in another workspace
- **WHEN** the same host/session/pane address appears with a different workspace name
- **THEN** the old association does not apply to it

#### Scenario: The lead restarts or another browser connects
- **WHEN** a saved association is read after a restart or from a different browser
- **THEN** the saved tags, names and colors are available

#### Scenario: A pane temporarily disappears
- **WHEN** a tagged pane goes offline and later returns with its original place identity
- **THEN** its tags are retained and shown again

### Requirement: Tag names resolve to a single colored definition
Each tag SHALL have an immutable identifier, a nonempty name and a color. Creating a new name SHALL randomly choose a color from a predefined palette once and persist it. Creating an existing name SHALL reuse its identifier and color. Name comparison SHALL trim outer whitespace and normalize Unicode NFC, then compare case-sensitively. An operator SHALL be able to rename and recolor a definition globally without changing its associations. Renaming to another existing name SHALL be rejected without merging or overwriting either tag.

#### Scenario: Two panes receive the same name
- **WHEN** an operator adds the same normalized name to two panes
- **THEN** both reference one definition with the same persistent color

#### Scenario: A tag is edited globally
- **WHEN** its name or color is changed successfully
- **THEN** every associated pane displays the new definition, and other visible browsers refresh it within the normal tag refresh interval

#### Scenario: A conflicting name is submitted
- **WHEN** a tag is renamed to a name already used by another tag
- **THEN** the editor explains the conflict and neither definition changes

### Requirement: Tag mutations are authenticated, atomic and conflict-aware
Only an authenticated same-origin Fleet session SHALL mutate tags. Writes SHALL be bounded and validated, use a fixed server-owned storage location and commit atomically. A stale document version SHALL be rejected with current state rather than overwrite another editor. Invalid or unreadable stored data SHALL produce an unavailable state and MUST NOT be replaced with an empty document by a subsequent mutation.

#### Scenario: Two editors save the same version
- **WHEN** two mutations race from one version
- **THEN** one succeeds and the other receives a conflict and current state

#### Scenario: A write fails
- **WHEN** storage is unavailable or a mutation is invalid
- **THEN** the previous durable state remains intact and the interface reports failure

#### Scenario: An unauthorized request arrives
- **WHEN** the request lacks authentication or a mutation comes from another origin
- **THEN** it is refused without changing the stored data

### Requirement: Named colored tags are visible and editable from native Agent rows
A tagged Agent rail row SHALL display an additional line below its current content with every assigned tag's name and color in assignment order. No tag SHALL be reduced to color alone or hidden behind a count. Long lines SHALL wrap within the row. Untagged rows SHALL reserve no tag-line space. The phone switcher SHALL use the same presentation. Rail badges SHALL use smaller text and color marks while keeping all names readable and wrapping within the text area. The compact tag-edit action SHALL stay below the star in a fixed trailing column, with enlarged independent targets for coarse pointers. A keyboard- and touch-accessible control SHALL allow selecting, creating and removing associations without opening the pane or toggling its favorite. Global tag editing SHALL remain reachable from the rail and Fleet settings even when no agent is listed. Editing controls SHALL report loading, saving, conflict and failure states, and colors SHALL supplement readable text.

#### Scenario: A row has several tags
- **WHEN** the rail renders the tagged pane
- **THEN** a separate line below its existing content shows its named colored tags in order and wraps as needed

#### Scenario: The last association is removed
- **WHEN** the operator removes a pane's last tag
- **THEN** its extra line disappears and other panes using that tag are unchanged

#### Scenario: The operator edits from a phone or keyboard
- **WHEN** the operator opens the tag editor and changes assignments or a global definition
- **THEN** all controls are reachable, focus remains in the dialog and returns on close, and the pane navigation and favorite actions do not fire
