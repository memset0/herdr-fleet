## 1. Footer facts

- [x] 1.1 Move host first and time last while retaining timestamp selection; verify focused Agent rail/tag cases.
- [x] 1.2 Verify wrapping, card-edge alignment and control clearance in Chromium, and run scoped lint, typecheck, fork/privacy and strict OpenSpec checks.

Verification: thirty focused Agent rail/tag cases, frontend typecheck, scoped lint, fork/privacy and strict change validation passed. Chromium checked 280/320/390px cards with 0/2/8 tags under dark/touch rendering: host first at the leading inset, time at the final right inset, natural wrapping and no control overlap or horizontal overflow. No full suite or writes.
