## 1. Arm the guard on this checkout

- [x] 1.1 Confirm `LOCAL.md` is ignored, then add a `private-names` block listing the operator's machine identifiers; never stage it.
- [x] 1.2 Record the guard's findings against the unscrubbed tree to confirm it now sees the fixtures.

## 2. Scrub the fixtures

- [x] 2.1 Replace the real host labels and the private workspace label in `web/src/lib/fleet-roster.test.ts` with outbuilding labels that keep the lead's id distinct from its name.
- [x] 2.2 Replace the real Tab label in `web/src/components/native-agent-rail.test.tsx` with an outbuilding label.
- [x] 2.3 Run both test files.

## 3. Changelog

- [x] 3.1 Complete the truncated introduction sentence about `## [Unreleased]` in the file's own voice.
- [x] 3.2 Add one bold-lead `[Unreleased]` line for the fixture scrub, describing it by shape.

## 4. Verify and publish

- [x] 4.1 Public-tree audit: the guard passes on the scrubbed tree, refuses a temporarily reintroduced name, and passes again after reverting; a tracked-tree grep outside the archive finds no machine identifier; list archived changes that still carry one, paths and counts only.
- [x] 4.2 Boundary audit: `bun scripts/check-fork.ts` passes and `FORK.toml` is unchanged; `openspec validate --strict` passes.
- [x] 4.3 Commit the implementation with an explicit pathspec, archive the change, commit the archive, and push without tags.
