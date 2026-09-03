## Purpose

Restores browser-local Agent favorites directly in Collie's native dashboard while preserving its
existing triage, routing, polling, and backend behavior.

## ADDED Requirements

### Requirement: Agent favorites use stable browser-local identity
Herdr Fleet SHALL identify a favorite Agent from the exact optional Host, optional Herdr session,
Pane id, and Agent implementation reported by the native Collie model. Favorite identity MUST
survive changes to status, timestamps, reachability, labels, terminal title, cwd, focus, and cached
or live presentation, but MUST NOT transfer to another Host, session, Pane, shell row, or Agent
implementation. It MUST NOT depend on a coding-agent thread or conversation id.

Favorites SHALL be a versioned browser-local presentation preference and SHALL NOT be sent to the
Gateway, Collie bridge, Herdr, or another browser. The stored representation and in-memory fallback
MUST have explicit size and entry-count bounds. Malformed, unsupported, oversized, unavailable, or
unwritable browser storage MUST leave the Agent list usable without a recovery request or backend
mutation.

#### Scenario: Agent presentation changes
- **WHEN** a favorited Agent changes status, timestamps, labels, cwd, focus, reachability, or cache source while its Host/session/Pane/implementation identity remains equal
- **THEN** the Agent remains favorited

#### Scenario: Pane identity is reused by another implementation
- **WHEN** the same Host/session/Pane later reports a different Agent implementation
- **THEN** the new Agent is not treated as the previous favorite

#### Scenario: The same pane id appears in another scope
- **WHEN** two Agent rows share a Pane id but differ by Host or Herdr session
- **THEN** each row has an independent favorite identity

#### Scenario: Another browser opens Fleet
- **WHEN** the same Fleet account is opened without the local favorite record
- **THEN** no favorite is inferred from account, Gateway, Collie, or Herdr state

#### Scenario: Browser storage cannot be used
- **WHEN** the stored record is malformed, unsupported, oversized, over capacity, or browser storage throws on read or write
- **THEN** Fleet continues with bounded in-memory favorite state and performs no network recovery

### Requirement: Native Agent rows expose an independent favorite control
Every native Agent row rendered by the shared Agent list SHALL expose a Collie-styled favorite
control. Shell rows MUST NOT expose the control. Activating the control SHALL toggle `aria-pressed`,
update the row's favorite presentation, and retain keyboard focus on the control.

Favorite activation MUST NOT open or focus the Pane, change the current route, invoke the row's
navigation action, submit a terminal action, request a refresh, close a surrounding native
surface, or mutate backend state. The row's existing open action and keyboard semantics MUST remain
available independently from the favorite control.

#### Scenario: Operator favorites an Agent
- **WHEN** the operator activates an unpressed favorite control
- **THEN** it becomes pressed, focus remains on it, the preference updates locally, and no Pane navigation or request occurs

#### Scenario: Operator removes a favorite
- **WHEN** the operator activates a pressed favorite control
- **THEN** it becomes unpressed, the local identity is removed, focus remains on the control, and the Pane is untouched

#### Scenario: Operator opens a favorited row
- **WHEN** the operator activates the row outside its favorite control
- **THEN** Collie's existing Pane-open behavior runs exactly once

#### Scenario: A shell row is rendered
- **WHEN** the native list contains a row whose kind is `shell`
- **THEN** the row retains its existing presentation and has no favorite control

### Requirement: Favorites sort first only inside existing triage sections
Inside each existing native `Needs you`, `Ready · unseen`, `Working`, and `Recent` section,
favorited Agents SHALL appear before non-favorited Agents. Within both partitions the implementation
MUST preserve the exact order produced by that section's existing Collie comparator, including the
selected newest/oldest direction for `Recent`.

Favorites MUST NOT create a new section, move a row across triage sections, change section order or
counts, alter unseen/attention classification, affect offline placement, change polling or
notification behavior, or replace Collie's triage comparator.

#### Scenario: A favorite is added inside a section
- **WHEN** an Agent becomes favorited
- **THEN** it moves above non-favorites in its current section while retaining its relative order among favorites

#### Scenario: A favorite is removed
- **WHEN** a favorite is removed
- **THEN** the Agent returns to the non-favorite partition in the order determined by the native comparator

#### Scenario: A favorite changes triage status
- **WHEN** a favorited Agent moves to another native triage section
- **THEN** it receives favorite priority only inside the new section and does not alter either section's classification

#### Scenario: Recent order is oldest-first
- **WHEN** the operator selects oldest-first for `Recent`
- **THEN** favorites remain the first partition and both favorite and non-favorite partitions retain oldest-first order
