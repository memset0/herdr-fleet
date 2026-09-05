## 1. The grammar

- [x] 1.1 Represent each modifier as absent / either / left / right rather than a boolean, and port the hazard checks, equality and formatting to it; verify the existing grammar suite passes unchanged in meaning
- [x] 1.2 Accept an `L`/`R` prefix on every spelling of a modifier the grammar already takes, keeping `left` and `right` reading as the arrow keys; verify with parse and round-trip-format tests
- [x] 1.3 Take the last modifier as the key when no key follows it, and stop asking that family for itself; verify `RAlt`, `Alt`, `LShift` and `Ctrl+RAlt` parse and format back
- [x] 1.4 Match a sided requirement against a set of modifier codes known to be down, defaulting to empty so an untracked caller matches nothing; verify with tests for both sides and for the absent set
- [x] 1.5 Mark a modifier bound as a key risky rather than refusing it; verify the hazard

## 2. The recognizer

- [x] 2.1 Record which modifier codes are down from their own keydowns, let go on keyup, and clear on cancel; verify a sided chord matches only while its side is held and never after a cancel
- [x] 2.2 Dispatch a modifier's keydown instead of ignoring it, while keeping a modifier pressed mid-sequence from completing or cancelling a pending prefix; verify both
- [x] 2.3 Register the keyup listener in the provider alongside the keydown one

## 3. The rule that makes it safe

- [x] 3.1 Refuse a document where any binding takes a modifier as its key and any other binding, the prefix included, holds it; verify one side, both sides, the unsided form, the prefix on each side of the rule, and that a bare modifier does not conflict with itself
- [x] 3.2 Report the conflict naming both bindings and where each came from

## 4. The microphone

- [x] 4.1 Add the three commands to the catalog, Pane-scoped and unbound
- [x] 4.2 Add a refusal that the dispatcher reports as the command's own sentence on the error channel, distinct from an ordinary throw; verify both paths
- [x] 4.3 Decide start / stop / refuse purely, with the transcribing case refusing all three; verify every condition and the ordering of the checks
- [x] 4.4 Register the three adapters in the composer over that decision, with the bridge's own reason where it gave one; verify the recorder is really reached, that a refusal creates nothing, and that the host's reason is the sentence shown
- [x] 4.5 Add the seven refusal strings to all six dictionaries

## 5. Verification

- [x] 5.1 Run both typechecks, the linter and the fork check, and the full suites on nvl72 against the pushed commit
- [x] 5.2 Record the new port on the already-attributed manifest entry
- [x] 5.3 Add the `CHANGELOG.md` lines under `## [Unreleased]`
