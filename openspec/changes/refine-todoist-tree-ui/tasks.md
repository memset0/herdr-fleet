## 1. First UI iteration

- [x] 1.1 Increase tree indentation and remove header completion controls; verify focused hierarchy and detail-only mutation tests.
- [x] 1.2 Verify Todoist component tests, frontend typecheck, scoped lint, fork and public-tree audits, and strict OpenSpec validation.
- [x] 1.3 Publish a lead-only PATCH and deploy; verify live build identity and preserve configuration.

## Acceptance

Keep this change active until explicit owner acceptance. Spec sync and archive are deferred.

## Verification

First iteration shipped as v3.9.7. Fifteen Todoist component tests, both typechecks, scoped lint, fork/privacy audits and strict change validation passed. Local and served Chromium verified 24px hierarchy steps, no row checkboxes, expanded completion actions and no horizontal overflow at 280px sidebar width. No full suite was run. Owner acceptance is pending; the change remains active.
