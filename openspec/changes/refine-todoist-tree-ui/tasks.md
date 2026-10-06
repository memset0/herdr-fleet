## 1. First UI iteration

- [x] 1.1 Increase tree indentation and remove header completion controls; verify focused hierarchy and detail-only mutation tests.
- [x] 1.2 Verify Todoist component tests, frontend typecheck, scoped lint, fork and public-tree audits, and strict OpenSpec validation.
- [x] 1.3 Publish a lead-only PATCH and deploy; verify live build identity and preserve configuration.

## Acceptance

Keep this change active until explicit owner acceptance. Spec sync and archive are deferred.

## Verification

First iteration shipped as v3.9.7. Fifteen Todoist component tests, both typechecks, scoped lint, fork/privacy audits and strict change validation passed. Local and served Chromium verified 24px hierarchy steps, no row checkboxes, expanded completion actions and no horizontal overflow at 280px sidebar width. No full suite was run. Owner acceptance is pending; the change remains active.

## 2. Guide and metadata iteration

- [x] 2.1 Replace enlarged padding with branch guides and move project metadata into details; verify focused component tests and browser branch geometry.
- [x] 2.2 Run focused tests, typechecks, scoped lint, privacy/fork audits and strict change validation.
- [x] 2.3 Publish and deploy a lead-only PATCH; verify served UI and unchanged configuration.

Second iteration shipped as v3.9.8: seventeen focused Todoist component tests, both typechecks, scoped lint, fork/privacy audits and strict change validation passed. Local and served Chromium verified compact connector guides, detail-only project metadata, completion actions and no horizontal overflow in a 280px rail, with no mutation requests. Owner acceptance remains pending.
