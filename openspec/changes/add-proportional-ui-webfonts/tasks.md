## 1. Fonts and scope

- [x] 1.1 Add the role-aware catalog and independent UI loader; verify focused catalog and stylesheet deduplication tests.
- [x] 1.2 Add UI choices, runtime/pre-paint classes and scoped Chat prose styling; verify picker persistence, class agreement and mono isolation.

## 2. Delivery

- [x] 2.1 Verify both fonts and Chinese Chat prose at phone width; run focused tests, types, scoped lint, fork/privacy and strict OpenSpec validation.
- [ ] 2.2 Publish a frontend PATCH, deploy and verify the served version before syncing and archiving this change.

Verification: 7 catalog cases and 62 focused DOM/picker/pre-paint/font/locale cases passed. Both type checks, scoped lint and fork/privacy checks passed. At a 390px touch viewport, both provider faces loaded, browser platform-font evidence confirmed real glyph rendering, Chat prose followed UI while code/mirror/draft stayed mono, density persisted and no horizontal overflow occurred.
