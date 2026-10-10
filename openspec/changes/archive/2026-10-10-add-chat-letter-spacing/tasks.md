## 1. Preference and ports

- [x] 1.1 Add owned spacing storage and Display controls; verify persistence, reset, bounds, invalid data and storage-event behavior.
- [x] 1.2 Connect the scoped Chat style and narrow native ports; verify existing text-size behavior and terminal isolation with focused tests and Chromium.

## 2. Release gates

- [x] 2.1 Verify typechecks, scoped lint, locale completeness, fork/privacy audits and strict OpenSpec validation before archive.

Verification: ten focused typography/Display cases passed, along with frontend typecheck, scoped lint, fork/privacy audits and strict validation. Chromium at 390px touch width verified native Chat font 14→12px, tighter spacing, persisted remount and reset; mirror 10px and draft 14px remained unchanged with no overflow. No full suite ran.
