## 1. The delta

- [x] 1.1 Verify the MODIFIED requirement's header matches the canonical one in
  `openspec/specs/fleet-upstream-sync/spec.md` exactly and carries the whole requirement, not a
  fragment, so archiving replaces rather than truncates it
- [x] 1.2 Verify the only prose that changed in it is the tag sentence and the closing paragraph, and
  that every scenario the canonical requirement had is still present. Verified: all four canonical
  scenarios carried over, one added ("A push is mistaken for completion"), and two of the three prose
  paragraphs changed — the tag sentence and the closing boundary

## 2. Coherence with what already exists

- [x] 2.1 Verify the added requirement agrees with `AGENTS.md` on the release recipe — three version
  files plus the newest numbered changelog heading, one `chore(release)` commit, one annotated tag,
  no GitHub Release — and states no step that file does not
- [x] 2.2 Verify it agrees with `fleet-release-publication` on tags and publication rather than
  restating or contradicting it
- [x] 2.3 Verify it agrees with `UPSTREAM.md` on what the correspondence table means: provenance, not
  a version component

## 3. Gates

- [x] 3.1 Run `openspec validate release-every-upstream-adoption --strict` and verify it passes
- [x] 3.2 Verify no source, tooling, manifest, or version file is modified by this change, and that
  `bun run test:fork` and `bash scripts/check-version.sh` still pass
- [x] 3.3 Verify the staged paths are only this change's own, with no other agent's work included
