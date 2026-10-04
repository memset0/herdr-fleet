## 1. Compact footer

- [x] 1.1 Implement the shared sliding indicator with stable 44px hit targets and reduced-motion support; verify the existing selector tests and browser geometry.
- [x] 1.2 Compact and center the neutral-gray build caption; update the obsolete footer alignment test and verify desktop/mobile footer behavior.

## 2. Verification

- [x] 2.1 Run both typechecks, full-tree lint, focused component tests, and the product build; inspect theme and reduced-motion behavior in a browser.
- [x] 2.2 Record the change under Unreleased, audit public-safe content and FORK.toml, and validate the completed OpenSpec change before archive.

## Verification evidence

- Focused component suites: 44 tests passed.
- Root and web typechecks, full-tree lint, product build, fork-boundary audit, privacy audit, and strict change validation passed.
- Chromium measured a 68px footer with two 44px hit targets in both themes. The single indicator moved between measured endpoints; reduced motion disables its transition. Narrow layout was inspected.
- Release assessment: frontend-only patch. Full release suites on the designated external runner are pending because it is unreachable. Archive records the verified implementation; push, tag and deployment remain pending that gate.
