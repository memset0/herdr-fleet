## 1. Command

- [x] 1.1 Add the unbound Pane catalog entry and constant guarded adapter; verify focused catalog and adapter-port tests.
- [x] 1.2 Verify command-bar search and invocation plus operator binding overrides for Send Alt+Up through focused frontend tests.

## 2. Gates

- [x] 2.1 Update the existing FORK.toml port inventory and pass fork-boundary and public-tree audits.
- [x] 2.2 Pass both typechecks, lint and OpenSpec validation; record targeted verification and PATCH release assessment.

## Verification record

- Command logic: `bun test fleet/ui/commands` — 115 passed.
- Browser command bar/provider: targeted Vitest suites — 58 passed.
- Root and web typechecks, full-tree lint, fork boundary, private-facts guard, and strict change validation passed.
- PATCH assessment: browser-only addition; existing peers support alt+Up, so no member deployment or protocol change is required.
- Release notes, archive, commit, publication and lead deployment are coordinated after the preceding release completes.
