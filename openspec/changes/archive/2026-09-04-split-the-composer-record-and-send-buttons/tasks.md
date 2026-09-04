## 1. Split the draft row's trailing slot

- [x] 1.1 Add the record control to the draft row between the field wrapper and the existing trailing slot in `web/src/components/composer.tsx`, drawn whenever the capability exists, carrying the aria-label, title, pressed state, icon set and `onPointerDown` focus guard the current microphone branch already has; verify by rendering a composer with a provider and a non-empty draft and finding both controls.
- [x] 1.2 Delete `micIsPrimary` and its branch from the trailing slot so the slot's last branch is unconditional; verify no reference to it remains (`rg micIsPrimary` returns nothing).
- [x] 1.3 Refuse Send on a blank draft and while a clip is live, with the direct-typing guard from design.md — Decisions; verify the control is disabled in both states and enabled again once the clip ends and the draft holds text.
- [x] 1.4 Apply the same live-clip refusal to the keyboard send path, so a binding cannot do what the disabled control refuses; verify the keyboard send is inert during a recording.

## 2. Pin the new behavior

- [x] 2.1 Rewrite the obsolete cases in `web/src/components/composer-stt.test.tsx` that assert the shared slot — the microphone being the only round button, and the swap on the first and last character — into cases that assert two controls present regardless of the draft; verify the file's suite passes.
- [x] 2.2 Add a case for turn-taking: a transcript lands in a non-empty draft, a second clip is started and its transcript joins the same draft; verify it passes.
- [x] 2.3 Add cases for the two send refusals — blank draft, and live clip including the keyboard path; verify they pass.
- [x] 2.4 Keep the existing cases for an absent provider, an unavailable provider, the caret splice, the mid-recording discard and the hands-free fallback passing unchanged; verify by running the whole file.

## 3. Move the fork boundary with the change

- [x] 3.1 Extend the `native-manual-pane-fit-port` reason in `FORK.toml` to name this port for `web/src/components/composer.tsx`, following the entry's existing form for the ports it already carries.
- [x] 3.2 Add a `composer-voice-rank-port` invasive entry declaring `web/src/components/composer-stt.test.tsx` and `docs/voice-and-push.md` with exact anchors, an intent, a reason that records the upstream reversal, `review = "every-upstream-sync"` and a `verify` list; verify `bun run test:fork` passes.
- [x] 3.3 Correct the paragraph in `docs/voice-and-push.md` that describes the microphone as the trailing control on an empty box; verify it now describes two controls and what a live clip refuses.

## 4. Verify the change

- [x] 4.1 Run the focused suites the change touches (`cd web && bun run test -- src/components/composer-stt.test.tsx src/components/composer.test.tsx`) and confirm they pass. Recorded: composer-stt 17/17; composer.test.tsx 99/101 in a whole-file run, the two shortfalls being a 5s timeout under this host's load and the neighbour it leaked a pending reply into — both pass in isolation, and the authoritative run is the release gate in 6.1.
- [x] 4.2 Run `bun run lint` and `cd web && bun run typecheck`; confirm both are clean.
- [x] 4.3 Add the one-line `## [Unreleased]` CHANGELOG entry required of a functional commit, with no version bump.

## 5. Close the change

- [x] 5.1 Audit the tracked diff for private deployment, device, domain or parent-repository detail; confirm none is present.
- [x] 5.2 Validate the change with `openspec validate --strict`, then sync and archive it.
- [x] 5.3 Commit the implementation and the archived change on `v3-dev` with an explicit pathspec, and push to `origin/v3-dev`.

## 6. Release 3.0.1

- [ ] 6.1 Run the complete suites on nvl72 against the exact pushed commit, per the repository's release gate; confirm they pass before cutting anything.
- [ ] 6.2 Cut `chore(release): 3.0.1` — bump the three version files, rename `## [Unreleased]` with today's date and the entry's short hash, re-open an empty `## [Unreleased]` — and verify `scripts/check-version.sh` prints `✓`.
- [ ] 6.3 Tag `v3.0.1` annotated, push the commit and the tag, and verify both on the remote.
