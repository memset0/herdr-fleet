## MODIFIED Requirements

### Requirement: Agent favorites use stable browser-local identity
Herdr Fleet SHALL keep no favourite state of its own. A "favourite" is the adopted Collie's own
per-device pin: the star a row carries reads and writes Collie's pin store, so pinning from the star
and pinning from Collie's own hold or actions sheet are one mechanism with two entry points. Bounds, browser locality and native entrypoints remain Collie's. For stable terminal identities, pin matching SHALL delegate to the Fleet terminal-binding contract and remain independent of layout and workspace names. Legacy rows SHALL migrate only under that contract; unsupported rows retain their existing place behavior.

The star SHALL be pressed exactly when Collie would list the row in its Pinned group. Nothing Fleet
does MAY send pin state to the Gateway, Collie bridge, Herdr, or another browser.

#### Scenario: Agent presentation changes
- **WHEN** a pinned Agent changes status, timestamps, labels, cwd, focus, reachability, or cache source while its row and workspace stay the same
- **THEN** its star stays pressed, because the pin is Collie's and Collie's identity has not changed

#### Scenario: Pane identity is reused by another implementation
- **WHEN** the same Host/session/Pane later reports a different Agent implementation in the same workspace
- **THEN** the star stays pressed if the original stable terminal identity is unchanged, and a replacement terminal does not inherit the pin

#### Scenario: The same pane id appears in another scope
- **WHEN** two Agent rows share a Pane id but differ by Host or Herdr session
- **THEN** each row's star reflects its own pin, because Collie's row identity includes Host and session

#### Scenario: Browser storage cannot be used
- **WHEN** browser storage throws or holds an unreadable pin record
- **THEN** the star still toggles Collie's in-memory pin state for the page and Fleet performs no network recovery

#### Scenario: A pane is pinned from Collie's own sheet
- **WHEN** the operator pins a pane from Collie's actions sheet
- **THEN** that pane's star is pressed on the dashboard and on the Agent rail without any second store being written

#### Scenario: A pane is pinned from the star
- **WHEN** the operator presses an unpressed star
- **THEN** Collie's pin store records the pin, and Collie's own sheet offers Unpin for that pane

#### Scenario: Another browser opens Fleet
- **WHEN** the same Fleet account is opened in a browser that holds no pins
- **THEN** no star is pressed and no pin is inferred from account, Gateway, Collie, or Herdr state
