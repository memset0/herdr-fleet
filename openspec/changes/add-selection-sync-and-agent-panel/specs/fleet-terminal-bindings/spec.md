## MODIFIED Requirements

### Requirement: Consumers share association semantics without sharing storage scope
Fleet SHALL provide idempotent attach, detach and lookup behavior through one binding interface, with namespaced relation kinds. Native favorites SHALL remain browser-local; tags and Todoist relations SHALL remain lead-persisted. Existing pin entrypoints SHALL continue to share one pin store.

#### Scenario: An association is attached twice
- **WHEN** a consumer repeats the same terminal/resource attachment
- **THEN** exactly one association exists and unrelated relation kinds are unchanged
