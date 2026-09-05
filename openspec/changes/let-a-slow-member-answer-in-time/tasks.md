## 1. Make the timing configurable

- [x] 1.1 Re-read upstream's budget arithmetic and its clamp, the child-environment builder and the configuration schema; record the task-owned paths.
- [x] 1.2 Add the validated `[pack]` section and pass its two values to Collie, resetting them so the configuration wins over an inherited environment.
- [x] 1.3 Add its tests: each bound, an omitted section leaving the environment untouched, and a value the clamp will bite recorded as the operator's own choice.

## 2. Tell the three states apart in the rail

- [x] 2.1 Fix the corroboration rule for a member never heard from, and add the test that a zero receipt is not an infinitely old one.
- [x] 2.2 Present a slow member as slow rather than refused, and test that the lead's own note is what decides.

## 3. Verify, release and deploy

- [ ] 3.1 Run the focused suites, both typechecks, lint and the fork check; assess the release axis and cut it.
- [ ] 3.2 Deploy to the lead with the measured timing, re-measure the member receipts, and archive.
