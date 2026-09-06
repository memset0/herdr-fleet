## 1. The fix

- [x] 1.1 Stop discarding the recorded sides when the page loses focus or is hidden
- [x] 1.2 Reconcile the recorded sides against every key event's own modifier state, dropping both sides of any family the event reports as not held
- [x] 1.3 Keep refusing a sided chord whose side was never observed

## 2. Coverage for what happens BETWEEN two keys

- [x] 2.1 Test that a sided chord fires when focus is lost between the modifier and the key it qualifies — the reported failure, which no existing test could have caught
- [x] 2.2 Test that a released side is dropped by the next event that reports the family up, so the other side does not inherit it
- [x] 2.3 Test that a never-observed side refuses

## 3. Verification

- [x] 3.1 Run both typechecks, the linter and the root suite
- [x] 3.2 Add the `CHANGELOG.md` line, deploy, and confirm on the machine that reported it
