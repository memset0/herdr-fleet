## 1. Add the check

- [x] 1.1 Re-read the working agreement's public-safety rule, the three existing guards and the hook that runs them, and the ignored local context file's role; record the task-owned paths.
- [x] 1.2 Add the check: shape rules for hosts, addresses, home paths and credential-shaped material; the publisher exemption; and the optional private-name source read from the ignored local context file, never echoed in output.
- [x] 1.3 Add its tests: one planted violation per shape, one negative control per exemption, one run with the local context file absent asserting the stated blind spot, and one asserting no finding repeats a value read from that file.

## 2. Run it and wire it up

- [x] 2.1 Run the check over the whole tracked tree and resolve every finding, either by making the value synthetic or by recording why it is public.
- [x] 2.2 Add it to the pre-commit hook as a fourth independent guard with its own named hatch, and list that hatch beside the other three in the working agreement.
- [x] 2.3 Verify the hatches stay independent and that the new guard refuses a planted violation and passes a clean tree.

## 3. Verify and publish

- [x] 3.1 Run the focused and full suites, both typechecks, lint, the fork check and strict OpenSpec validation; commit only this change's paths, push, then sync, archive, push the archive separately and redeploy the archive HEAD.
