## MODIFIED Requirements

### Requirement: Tags belong to pane places and are shared by the lead
Fleet SHALL persist a global tag catalog and pane associations on the lead. Stable associations SHALL use the shared Fleet terminal-binding contract, independent of layout names and agent conversation. Existing place associations SHALL migrate only with the unique evidence required by that contract; unresolved records SHALL remain recoverable. Temporary absence SHALL NOT remove associations. Favorites SHALL remain browser-local and use the same identity contract through their native store.

#### Scenario: An agent is replaced in a pane
- **WHEN** another agent or conversation occupies the same pane in the same workspace
- **THEN** its tags remain attached

#### Scenario: A pane identity is reused in another workspace
- **WHEN** the same host/session/pane address appears with a different terminal identity
- **THEN** the old association does not apply to it

#### Scenario: The lead restarts or another browser connects
- **WHEN** a saved association is read after a restart or from a different browser
- **THEN** the saved tags, names and colors are available

#### Scenario: A pane temporarily disappears
- **WHEN** a tagged pane goes offline and later returns with its original terminal identity
- **THEN** its tags are retained and shown again

#### Scenario: A workspace is renamed or a terminal moves
- **WHEN** the terminal keeps its identity while its layout address or workspace name changes
- **THEN** its tags continue to apply through the shared binding layer
