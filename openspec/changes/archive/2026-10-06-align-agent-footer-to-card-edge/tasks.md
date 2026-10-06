## 1. Footer alignment

- [x] 1.1 Remove the footer action reserve while keeping the body reserve; verify focused tag tests and rendered right inset/control clearance.
- [x] 1.2 Verify tag wrapping, scoped lint, fork/privacy audits and strict change validation before archive.

Verification: eight focused tag component cases and scoped lint/fork/privacy checks passed. Chromium tested 280/320/390px cards with 0/2/8 tags under dark/touch rendering: 12px right inset, no horizontal overflow, final-line host alignment and no overlap with action hit areas. No full suite ran.
