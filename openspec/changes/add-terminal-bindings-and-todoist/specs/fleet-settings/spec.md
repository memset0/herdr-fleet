## MODIFIED Requirements

### Requirement: Fleet keeps its own settings document beside its configuration
Fleet SHALL keep its operator-facing settings in one JSON document in the same directory as its
private configuration file, under the same ownership and permission posture. Todoist connection and selected-project state SHALL instead remain in its private integration state so changing a grant and its project scope is atomic; this exception SHALL NOT move ordinary Fleet settings out of their shared document. It MUST NOT write these
settings into that configuration file, and it MUST NOT write them into any file Collie owns.

The document SHALL carry an explicit schema version. An absent document SHALL mean "every shipped
default", not an error. A document that names an unknown top-level section SHALL be rejected rather
than partially applied.

Settings whose subject is the device — the rails' preferred widths, the fallback face, Agent
favorites — SHALL remain browser-local and MUST NOT be moved into this document.

#### Scenario: No document exists
- **WHEN** Fleet starts with no settings document present
- **THEN** every setting takes its shipped default and Fleet reports no error

#### Scenario: A device preference stays local
- **WHEN** the operator changes a rail's width or the fallback face on one browser
- **THEN** the settings document is unchanged and another browser is unaffected


## ADDED Requirements

### Requirement: Todoist settings separate connection scope from presentation
The Fleet settings group SHALL expose installation-wide Todoist connection status, connect/disconnect actions and selected project. The server SHALL store credentials privately outside the browser-readable settings document. Task view and expansion preferences SHALL remain browser-local. An unconfigured integration SHALL offer clear setup status without affecting existing Fleet features.

#### Scenario: The project changes
- **WHEN** the operator selects a different project in Settings
- **THEN** Todoist surfaces refresh to that project and stale task operations from the previous selection are refused

#### Scenario: The browser reads settings
- **WHEN** the settings interface loads connection information
- **THEN** it receives status and project metadata without client secrets or access tokens
