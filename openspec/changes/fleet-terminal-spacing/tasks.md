## 1. Preference

- [x] 1.1 Bounded, snapped, per-browser spacing store with default fallback; verify parsing and clamping unit tests.

## 2. Surface

- [x] 2.1 Spacing rows (`ui/numeric-setting-row.tsx`, ft() in all seven locales) after Text size in the Display sheet while the terminal surface is selected.
- [x] 2.2 Spacing joins the terminal face; a change sets `lineHeight`/`letterSpacing` in place and re-fits through the existing report; verify a component test.

## 3. Delivery

- [x] 3.1 Run focused tests, both typechecks, `bun run lint`, `check-fork`, `check-private-facts` and strict OpenSpec validation.
- [ ] 3.2 Deploy to the lead and step both spacings on a live terminal.
