# fleet-terminal-bindings Specification

## Purpose

Provide shared terminal references and association behavior so Fleet features follow the same running terminal across layout changes.

## Requirements

### Requirement: Associations identify terminals independently of layout
Fleet SHALL use one scoped terminal identity contract for favorites, tags and external-task bindings. A reference SHALL distinguish host and multiplexer session, and SHALL NOT depend on workspace, tab, position, label or agent conversation. Unsupported identities MUST NOT be fabricated from layout addresses. Shared references SHALL be opaque data and MUST NOT expose or authorize a raw terminal command identifier.

#### Scenario: A terminal changes layout
- **WHEN** tabs reorder, panes swap, a terminal moves across workspaces, or labels change
- **THEN** all terminal-backed associations still refer to the original terminal

#### Scenario: A terminal is replaced
- **WHEN** a terminal closes and a new terminal occupies its former address
- **THEN** the replacement inherits none of its terminal-backed associations

#### Scenario: Different hosts report equal local identities
- **WHEN** local terminal IDs coincide across hosts or multiplexer sessions
- **THEN** their associations remain distinct

### Requirement: Resolution is live and unambiguous
Fleet SHALL resolve durable references to their current pane locations. Missing, stale, unsupported or ambiguous evidence SHALL prevent navigation or delivery to a guessed target. Temporary unavailability SHALL retain associations.

#### Scenario: A peer is offline
- **WHEN** its current inventory is unavailable
- **THEN** the reference is unavailable and its associations remain stored

#### Scenario: A backlink is followed after movement
- **WHEN** the original terminal is live in a different workspace
- **THEN** the link resolves to that terminal's current native pane route

### Requirement: Consumers share association semantics without sharing storage scope
Fleet SHALL provide idempotent attach, detach and lookup behavior through one binding interface, with namespaced relation kinds. Favorites SHALL remain browser-local; tags and Todoist relations SHALL remain lead-persisted. Existing pin entrypoints SHALL continue to share one pin store.

#### Scenario: An association is attached twice
- **WHEN** a consumer repeats the same terminal/resource attachment
- **THEN** exactly one association exists and unrelated relation kinds are unchanged

### Requirement: Legacy records migrate only with unique evidence
Migration SHALL require a fresh unique match of the original host, session, pane and workspace together with a stable terminal identity. Unresolved records SHALL be retained without guessed migration. Conversion SHALL preserve payload and avoid duplicate associations.

#### Scenario: A legacy row is absent or ambiguous
- **WHEN** migration cannot uniquely resolve its original target
- **THEN** the record remains recoverable and is not attached to a similarly named terminal
