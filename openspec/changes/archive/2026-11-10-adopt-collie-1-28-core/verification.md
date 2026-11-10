# Acceptance evidence

## Source suites

- `bun run lint`, `bun run typecheck` and `cd web && bun run typecheck`: pass on the final implementation.
- `bun run test:fleet`: 1,641 pass, zero failures across 89 files.
- Root backend sweep: 10,393 pass, 43 skip; one asynchronous theme-registry fixture race was corrected by waiting for its explicit fetch-start signal. Its complete 39-test file then passed. An earlier complete backend sweep passed 10,394 tests. All remaining root CLI, scripts, integration-module and shell lanes then passed, including lifecycle, payload, toolchain, version/tag, hook and packaging checks.
- Web full sweep: 685 files and 57,451 cases, with 12 failing files. Every failing file was subsequently rerun in full after corrections: six-file pass/failure collection plus complete wide-layout/gallery rerun (69 pass), profile/corpus/unread rerun (835 pass) and detector/plain-fold rerun (24 pass). Composer, service-worker routes, fonts and telemetry notice also passed their complete files. This is complete-sweep coverage plus full failed-file reruns, not a claim of a single green full sweep.
- Upstream assertions remain intact. Corpus time budgets reflect the complete fixture walk; the gallery awaits lazy sections before querying them; root-only mode-bit fixtures skip only the permission-denial branch that the superuser bypasses.
- Patient send integration: delayed successful evidence, immediate fast success, a real draft's refusal, Codex Enter steering and a profile wait exhausting the global bound. No background send hold or automatic resend is introduced.

## Native Core and HTTP

An isolated native Core and synthetic shell terminal, separate from every deployed runtime, passed:

- Explicit column fit with unchanged rows, one retained connection, and original geometry restored when the controller is disposed.
- Native input and subsequent screen read.
- Real HTTP response after 11.2 seconds of quiet, proving the explicit 130-second listener bound survives Bun's shorter default.
- Full standalone Fleet start with synthetic operator login, authenticated snapshot and pane read, explicit fit, terminal WebSocket input/output, refusal of the second browser after its first viewport, and Fleet restart retaining Core identity and the same terminal.

Patient send recovery uses deterministic delayed-screen integration fixtures; no synthetic message was typed into an operator's real terminal. Runtime identity, endpoints, local logs and credentials are intentionally excluded from this public record.

## Browser and release gates

Native navigation/browser suite: 46 pass, 44 expected project/layout skips. Its two phone timing/navigation failures passed in the complete eight-case pane-glide file with one worker and unchanged assertions. Fleet panel: 18 pass across phone/tablet. Update-worker: 9 pass, 13 explicit project/case skips.

Privacy audit: pass. Strict change validation: pass. Version consistency before the release: pass at 3.24.3. The release commit separately advances all version files to 4.0.0. All declared verification paths exist; their root, web, Fleet and browser lanes passed as recorded above. All invasive review markers now name v1.28.0.

The merge second parent is exactly the adopted v1.28.0 commit. The separately authorized major release is 4.0.0, with an annotated tag on its separate release commit; the exact branch and product tag were pushed successfully. Final production build passed. The push reran both typechecks and used the documented test-skip switch only to avoid repeating the completed full sweep and passing failed-file reruns. Bulk staged-path guard predicates were verified against 3,000 paths with protocol checks enabled.

The selected lead deployment passed authenticated configuration, snapshot, crew, pane and fit-capability reads. Its permanent Core identity and every pre-existing foreground process remained unchanged after Fleet replacement. The same exact release was confirmed on two members; any remaining member rollout belongs to the separate deployment workflow, not to a claim of fleet-wide completion here. Legacy task data and external tasks were left untouched.

All six delta capabilities were checked against the synchronized canonical set. The retired Todoist capability, including its Purpose, was removed under the explicitly declared capability-retirement marker. All 32 remaining canonical specifications pass strict validation. An existing precache Purpose placeholder was filled while verifying its already authoritative 4 MiB requirement.
