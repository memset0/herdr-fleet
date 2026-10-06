## 1. Temporary port

- [x] 1.1 Expose optional strip-band style variables and supply them from the owned shell; verify focused native strip tests and rendered padding/background geometry.
- [x] 1.2 Update FORK.toml, audit public source, run typechecks and scoped lint, and validate the change before archive.

Verification: 61 focused card/tag/Tab tests and one focused native Pane port case passed, along with both typechecks, scoped lint, fork/privacy audits and strict validation. Chromium verified symmetric 4px chrome strip padding, light/dark grounds, 32px combined avatars, lower-corner badges, 280/320/390px panels, 0/2/8 tags, wrapping and final-line host alignment on desktop/touch, with no writes. No full suite.
