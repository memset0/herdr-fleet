## 1. Controls and state

- [x] 1.1 Add the reusable numeric settings primitive in its own commit and verify scoped lint before adopting it.
- [x] 1.2 Extend owned density state, lower limits and native padding markers; verify focused persistence, reset, bounds and default-preservation tests.

## 2. Verification and delivery

- [x] 2.1 Verify actual Chat/tool layout, containment, independent fonts and hit areas in a narrow browser; run typecheck, scoped lint, locale and fork/privacy checks.
- [x] 2.2 Validate, sync, archive, publish and deploy this density stage before starting UI-font work.

Verification: 59 focused typography/card cases and 22 Display/locale cases passed; web and runtime types, scoped lint and fork/privacy guards passed. A 390px touch viewport retained preferences, rendered 10px prose with 1.55 line height and zero block padding/gap, preserved 12px containment and unchanged 10px mirror/14px draft, with no horizontal overflow.

Delivered as frontend PATCH 3.15.3; the premature 3.15.2 tag was not deployed. Source and served build were verified before archive.
