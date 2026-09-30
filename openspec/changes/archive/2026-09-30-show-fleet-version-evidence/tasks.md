## 1. Observe published Fleet versions

- [x] 1.1 Implement the fork-owned stable-tag parser and numeric selector, accepting only annotated `vMAJOR.MINOR.PATCH` refs and retaining the greatest release per major; verify malformed, prerelease, lightweight and lexical-order traps with the focused pure test.
- [x] 1.2 Implement the bounded coalesced observer with fresh, stale and unavailable results, one retained successful value and a retry floor; cover concurrent calls, cache expiry, source failure, response-size rejection and timeout behavior without real network access.
- [x] 1.3 Expose `GET /fleet/api/version` below the Fleet Gateway session gate and initialize the fixed observer in the Gateway entrypoint; verify unauthenticated refusal, authenticated response, method refusal and zero proxy/update side effects with the focused Gateway route test.

## 2. Connect and classify shared shell evidence

- [x] 2.1 Add mirrored release/member version view types and the typed frontend read, then start its optional `/api/pack` and release reads beside—but never in front of—the required root snapshot; retain the last view through optional-source failures and cover nonblocking first navigation in loader tests.
- [x] 2.2 Implement the pure host-version classifier for compatible patch, higher minor, manual major, development prerelease, last-reported, stale/unavailable release evidence and unknown runtime identity; verify numeric SemVer and state precedence with focused owned tests.
- [x] 2.3 Join member observations to the existing server roster in the native shell and carry only the resulting display state through the hierarchy model; verify no request/timer is created per row and health-driven ordering, folding, navigation and actions remain unchanged.

## 3. Render host and page version identity

- [x] 3.1 Render the full reported runtime identity with localized outdated, manual-major, development, last-reported, unknown and release-freshness wording on Host rows; verify higher-minor, compatible patch, offline, unknown, development and stale-source states in the actual desktop rail and mobile drawer fixtures without changing existing health presentation.
- [x] 3.2 Add one fork-owned navigation footer composing the unchanged Collie/TTYD selector followed by the current page's `Herdr Fleet` build identity from `__BUILD_INFO__`; verify formal and development builds, desktop/mobile mounting, narrow layout and independence from selected host/release availability.
- [x] 3.3 Add every new string to all seven typed dictionaries and verify dictionary parity plus accessible row/footer wording.

## 4. Reconcile product ownership and documentation

- [x] 4.1 Update the public Fleet documentation and working agreement for read-only version evidence, freshness, runtime-vs-install meaning and the fixed bounded metadata egress exception; verify no private deployment fact, host identity, credential or source path is present.
- [x] 4.2 Add one crisp Unreleased changelog line and update `FORK.toml` owned paths, contracts, verification and narrow invasive anchors against the final diff without changing version files or upstream provenance.
- [x] 4.3 After concurrent edits settle, run focused observer/classifier/Gateway/loader/navigation/footer/i18n checks, both root and web typechecks, fork/private-fact checks and strict OpenSpec validation; exercise the real native shell at desktop and mobile widths with synthetic mixed-version data and report the patch-axis assessment without archive, release, tag, publish or deployment.