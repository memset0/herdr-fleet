## 1. Cut the version

- [x] 1.1 Re-read the versioning and release sections of the working agreement, the provenance record, and `scripts/check-version.sh`; verify a clean tree equal to its upstream and record the task-owned paths.
- [x] 1.2 Set the three version files to `3.0.0`, rename the unreleased changelog heading to `3.0.0` with its real date and each entry's short commit hash in the file's link style, and re-create an empty unreleased heading above it.
- [x] 1.3 Record the exact Collie release this tree corresponds to as provenance, and state in the working agreement that the version line is this product's and that development happens on the default branch.
- [x] 1.4 State the release policy in the working agreement — the redeploy-reach axis, who may cut each level, the per-change assessment, and the release commit's exact shape — and reconcile it with the axis the agreement inherited from upstream rather than leaving both standing.
- [x] 1.5 Separate the changelogs: retain upstream's byte-identical under its own name, leave this product's entries in the canonical file, and retire the invasive declaration that existed only because the two were interleaved.
- [x] 1.6 State the fork-boundary rules in the working agreement — minimal invasiveness, `FORK.toml` moving with the boundary, upstream `.adr/` left untouched, and the working agreement governing any conflict — and reconcile the existing decision-record guidance with the last of them rather than leaving both standing.
- [x] 1.7 Run the version check, both typechecks, lint, the fork check, the production build and strict OpenSpec validation.

## 2. Publish it

- [x] 2.1 Commit the release as one commit that does nothing else, with the required trailers.
- [x] 2.2 Tag it annotated as this product's version, push the commit and the tag, and verify both on the remote.

## 3. Move the branches

- [ ] 3.1 Rename the previous generation's branch to the archival name that states its own release and the Collie release it carried, and verify its commits and tags are untouched.
- [ ] 3.2 Rename the development branch to the default name, verify the remote's default branch moved with it, and verify no commit was rewritten and no branch force-updated.
- [ ] 3.3 Update every consumer that resolves the development branch by name, and verify a fresh clone arrives on the development line.

## 4. Verify and archive

- [ ] 4.1 Deploy the exact tagged commit to existing staging, verify readiness and that the pack is unchanged, then sync, archive, push the archive separately and redeploy the archive HEAD.
