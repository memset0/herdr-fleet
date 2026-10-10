## 1. Role settings

- [x] 1.1 Implement bounded role preferences, exclusive modes and legacy migration; verify focused storage and role-isolation tests.
- [x] 1.2 Restore native font pickers, add the flat dual-role CJK card and move Fleet settings below native rows; verify baseline equality, control behavior and settings order.
- [x] 1.3 Apply both modes to UI/Chat, mirror and real terminal font measurement; verify role stacks and dynamic changes without losing terminal symbols.

## 2. Delivery

- [x] 2.1 Run focused tests, phone-width font/mode checks, types, scoped lint, fork/privacy and strict validation.
- [x] 2.2 Publish/deploy the frontend PATCH, verify the served build and then sync/archive the completed change.

Verification: 9 focused catalog/storage/migration cases passed, with focused controls, native picker, locale, stylesheet and real-terminal cases. Both type checks, scoped lint and fork/privacy checks passed. Five restored native font files match Collie v1.19.0 byte-for-byte. A 390px touch viewport loaded both real UI faces, kept the native English face first in fallback mode, applied each exclusive mode independently, restored native stacks and removed provider links for None, retained Chat density and had no overflow.

Delivered as frontend PATCH 3.15.5; served role controls, English labels and release identity verified before archive.
