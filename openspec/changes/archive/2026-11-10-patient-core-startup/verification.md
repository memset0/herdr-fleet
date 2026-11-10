# Verification

- Full Fleet suite: 1,644 pass, zero failures across 90 files.
- Focused startup coverage: delayed Core readiness, legacy refusal, prompt success, finite failure, caller/lock ordering, concurrent starts sharing one supervisor and complete child cleanup.
- The real synthetic delayed-listener fixture binds after thirteen seconds and passes through the actual control and daemon entrypoints.
- Full root test script: pass, including backend, CLI, scripts, lifecycle, tag/hook and packaging lanes.
- Both typechecks and full-tree lint: pass.
- Web changed-file lane: zero affected test files; the runtime policy has no frontend import path.
- Fork boundary, privacy audit, strict change validation and version consistency: pass. No upstream-owned file changed.

The minor release and operator acceptance are recorded after completion; operational observations remain outside this public tree.

The functional commit passed selected lead acceptance before cutting the minor. Release 4.1.0 has an annotated tag on its separate release commit; 4.0.0 remains unchanged. The standard production build passed. Focused web version/header/PWA coverage passed 21 tests across three files; the unchanged UI corpus was already covered by the adoption baseline. No private deployment values are recorded here.

The selected Core deployment passed actual cold-start acceptance under the new bounded policy. Authenticated reads and unchanged terminal-runtime continuity were verified by the separate operator workflow; its records remain operator-local. The public source and delta set passed final strict validation and privacy checks.
