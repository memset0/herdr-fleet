## 1. Disarm the automatic publication

- [x] 1.1 Replace the `push: tags` trigger in `.github/workflows/release.yml` with `workflow_dispatch`, leaving every job untouched, and record at the trigger why it is not a push trigger; verify the file still parses as YAML and that no `on:` key names a push.
- [x] 1.2 Confirm nothing else in the repository triggers a Release; verify by searching the workflow directory for other release-creating steps and reporting what is there.

## 2. Move the rule to match

- [x] 2.1 Rewrite the MANDATORY publish paragraph in `AGENTS.md` so it keeps the tag requirement and states that no Release is published, with the reason (this product installs through Herdr and its update paths read the upstream repository); verify no sentence in that section still instructs an agent to publish.
- [x] 2.2 Correct the two comments in `scripts/check-tag.sh` that describe the tag as what the release workflow waits for; verify `bash scripts/check-tag.sh` still passes on the current checkout.

## 3. Move the fork boundary with the change

- [x] 3.1 Add an invasive entry for `.github/workflows/release.yml` with an exact anchor, an intent, `review = "every-upstream-sync"`, a `verify` list and a reason recording that the missing trigger is deliberate; verify `bun run test:fork` passes.

## 4. Verify and close

- [x] 4.1 Run `bun run lint` and `bash scripts/check-version.sh`; confirm both are clean and the version is unchanged, since this change is documentation and CI configuration and warrants no release.
- [x] 4.2 Audit the tracked diff for private deployment, device, domain or parent-repository detail; confirm none is present.
- [x] 4.3 Validate with `openspec validate --strict`, then sync and archive the change.
- [x] 4.4 Commit on the default branch with an explicit pathspec and push, naming no tag on the push line.
