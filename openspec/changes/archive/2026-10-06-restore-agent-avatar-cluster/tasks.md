## 1. Row layout

- [x] 1.1 Restore the combined avatar across two text lines and reserve the tag/host footer; verify targeted rail and tag tests.
- [x] 1.2 Verify desktop/touch geometry, tag wrapping, right-aligned host and independent actions in Chromium.

## 2. Release checks

- [x] 2.1 Run both typechecks, scoped lint, fork/privacy audits and strict change validation.

Verification: 61 focused card/tag/Tab tests and one focused native Pane port case passed, along with both typechecks, scoped lint, fork/privacy audits and strict validation. Chromium verified symmetric 4px chrome strip padding, light/dark grounds, 32px combined avatars, lower-corner badges, 280/320/390px panels, 0/2/8 tags, wrapping and final-line host alignment on desktop/touch, with no writes. No full suite.
