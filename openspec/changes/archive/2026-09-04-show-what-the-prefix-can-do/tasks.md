## 1. Deriving what the prefix leads to

- [x] 1.1 Add a pure `prefixHints()` over the effective bindings that keeps only prefix bindings, labels each second chord as the operator would press it, groups by the command's scope in a fixed order and sorts within a group; verify tests cover a rebound command, an unbound one, a command reached by two prefix chords, and that no direct chord appears
- [x] 1.2 Give the derivation a bounded ceiling that reports how many entries it dropped rather than returning all of them; verify a test covers a set larger than the ceiling and one exactly at it

## 2. The panel

- [x] 2.1 Add the fork-owned hint panel: fixed to the bottom edge, several dense columns, group headings, small type, the app's own tokens in both themes; verify a test asserts it holds no space, has no focusable or clickable child, and is hidden from assistive technology
- [x] 2.2 Distinguish an entry whose scope has no current target from one that would act, without removing it; verify a test covers both states of the same entry
- [x] 2.3 Show the dropped-entry count when the ceiling elides; verify a test covers the elided case

## 3. Arming it

- [x] 3.1 Give the provider a delayed pending signal: start a bounded timer when the recognizer reports an armed prefix, clear it on every other outcome and on every cancel path; verify tests prove a prompt sequence never shows the panel, a pause does, and completion, expiry, `Escape` and blur each hide it immediately
- [x] 3.2 Prove the panel never intercepts the second chord: with the panel shown, the next key still reaches the recognizer and runs its command; verify a test drives the full pause-then-complete sequence
- [x] 3.3 Honour reduced motion by animating at no time at all — a panel with a 1.6s life has nothing an entrance would buy; verify the rendered panel carries no transition or animation class

## 4. Documentation and gates

- [x] 4.1 Document the panel in the public keyboard-commands section — what it lists, that it is generated from the operator's own bindings, and that it waits; verify the documentation contract test still agrees with the catalog
- [x] 4.2 Add the panel's labels to all six typed dictionaries and record the widened port in `FORK.toml`; verify `bun scripts/check-fork.ts` and the i18n test pass
- [x] 4.3 Add one `CHANGELOG.md` line under `## [Unreleased]` and change no version file; verify `bash scripts/check-version.sh` passes
- [x] 4.4 Run the owned suites, both typechecks, lint, the fork check and strict OpenSpec validation; verify all pass
- [x] 4.5 Run the full root and web suites and the build once commit-ready; verify any remaining failure fails identically on the unmodified tree
- [x] 4.6 Re-read the planning artifacts against what was built and reconcile any drift before archive
