## 1. Configuration and lifecycle

- [x] 1.1 Implement strict external transport parsing and preserve SSH parsing; verify external acceptance, missing/unknown/credential fields, loopback/collision refusal and existing SSH tests.
- [x] 1.2 Omit only the external peer SSH child and skip only its SSH-file preflight; verify child selection with/without terminal and startup/lifecycle behavior with the external projection absent.
- [x] 1.3 Report explicit external ownership through control status without changing existing text; verify protocol parsing/formatting and local readiness without asserting remote connectivity.

## 2. Documentation and source acceptance

- [x] 2.1 Deliver exact generic operator and changelog drafts in this change, coordinate shared-file integration and verify examples with the parser before publication.
- [x] 2.2 Run both typechecks, full-tree lint, build, backend/frontend tests and focused lifecycle verification; record unrelated concurrent failures honestly.
- [x] 2.3 Audit public-safe owned changes and fork boundary, reconcile artifacts and validate this change strictly before archive.
- [x] 2.4 Assess the release axis and receiving-member scope, coordinate shared changelog/docs, and record the exact minor publication decision under the product working agreement before version/tag/deployment.
