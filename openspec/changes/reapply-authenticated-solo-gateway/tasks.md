## 1. Establish the fork and configuration boundary

- [x] 1.1 Re-read the exact Collie v1.2.0 baseline, current source instructions, this change, and the reviewed v2 owned authentication/supervisor modules; record the clean `v3-dev` baseline and exact task-owned paths before implementation.
- [x] 1.2 Add `FORK.toml` plus the smallest reusable fork-manifest parser/checker, classify every path changed since the Collie baseline including OpenSpec setup, and verify the checker rejects an unclassified or overbroad invasive path.
- [x] 1.3 Change the Herdr plugin identity to `memset0.herdr-fleet`, preserve Collie attribution, add the minimum owned entrypoint/build ports, and verify manifest/package/version checks remain coherent without cutting a release.
- [x] 1.4 Implement strict `fleet/config.ts` schema-version-1 parsing with Bun TOML, accepting only the lead role and one loopback Gateway/Collie pair while rejecting unknown, peer, hosts, SSH, transport, and Pack fields; verify focused parser tests cover every rejection family.
- [x] 1.5 Resolve only an explicit or Herdr-provided owner-only `fleet.toml`, reject absent/broad-permission files without leaking values, ignore any repository-root live file, and verify temporary-file permission tests plus `git check-ignore` protect local configuration.
- [x] 1.6 Build the sanitized Fleet-to-Collie child environment that forces loopback/external ingress, exact Host/Origin, and `COLLIE_SKIP_SERVE=1` while removing conflicting inherited Tailscale identity/publication values; verify focused environment tests and unchanged standalone Collie behavior.
- [x] 1.7 Update `FORK.toml` and `CHANGELOG.md`, run focused configuration/fork/version/type checks, commit this stage separately, fetch/verify `origin/v3-dev`, and push a normal buildable commit.

## 2. Reapply and harden the authentication core

- [x] 2.1 Implement versioned HMAC session tokens with random 256-bit session ids, bounded issuance/expiry validation, constant-time signature comparison, and no credential-bearing diagnostics; verify tamper, malformed, future, expiry, and secret-rotation tests.
- [x] 2.2 Implement the owner-only versioned active-session store using one-way id digests, atomic writes, bounded pruning, restart-safe recognition, and fail-closed unreadable-state behavior; verify login persistence, logout revocation, copied-token refusal, expiry pruning, permissions, and corrupt-state tests.
- [x] 2.3 Reapply single-account Argon2id verification with bounded username/password/form inputs and externally equivalent credential failures; verify correct, wrong-user, wrong-password, combined-failure, oversized, and malformed-request cases.
- [x] 2.4 Reapply the login limiter as finite per-source plus aggregate budgets with bounded recovery, using client identity supplied only by the trusted listener boundary; verify source rotation, spoofed forwarding fields, capacity, recovery, success isolation, and no-verification-while-blocked behavior.
- [x] 2.5 Implement exact-Origin login/logout transitions and relative-only safe-return normalization; verify scheme-relative, absolute, alternate-port, userinfo, encoded-authority, backslash, control-character, malformed, and cross-origin cases all fall back or fail closed.
- [x] 2.6 Reapply the JavaScript-free login page using Collie v1.2.0 typography/tokens, accessible labels/autocomplete/focus behavior, generic escaped errors, and no reflected credentials; verify one focused markup/style test rather than duplicating Collie's component suite.
- [x] 2.7 Update `FORK.toml` and `CHANGELOG.md`, run the authentication test subset and root typecheck, commit this stage separately, fetch/verify `origin/v3-dev`, and push a normal buildable commit.

## 3. Add the authenticated single-upstream Gateway

- [x] 3.1 Implement the Fleet Gateway route classifier so only authentication endpoints and the exact update-safe static allowlist are public, every `/api/*` returns `401` before upstream access without a session, and every other document navigation enters login; verify path normalization and source-map/filesystem negatives.
- [x] 3.2 Implement the one-loopback Collie proxy with parsed target construction, bounded streaming bodies, a narrow request-header allowlist, removal of Fleet/Authorization/forwarding/Tailscale/device credentials, and exact public Host/Origin reconstruction; verify request, upload, conditional-read, and spoofed-header cases.
- [x] 3.3 Implement response filtering with hop-by-hop/stale encoding removal, Fleet-cookie protection, no-store policy, and parsed exact-origin Location rewriting; verify malicious userinfo/prefix redirects, foreign redirects, cookies, 304, streaming, and upstream failure behavior.
- [x] 3.4 Wire the Gateway listener so it binds only to configured loopback, validates the exact public Host, derives trusted client attribution only for a loopback proxy peer, applies security headers by response class, and reports readiness without exposing configuration or secrets; verify listener-level Host/Origin/client-address tests.
- [x] 3.5 Update `FORK.toml` and `CHANGELOG.md`, run Gateway/auth/config focused tests plus root typecheck, commit this stage separately, fetch/verify `origin/v3-dev`, and push a normal buildable commit.

## 4. Reapply the Herdr-owned lead lifecycle

- [x] 4.1 Reapply only the generation-qualified v2 supervisor primitives needed to start, monitor, stop, restart, and inspect the Gateway and Collie children under `fleet/`, excluding collector, iframe, node transport, SSH, ttyd, and notification imports; verify a source-boundary test enforces the exclusion.
- [x] 4.2 Add a private generation-qualified control socket, exact in-process child handles, readiness ordering, bounded shutdown, partial-start cleanup, and generation handoff without pid files or killing by port/process name; verify focused protocol/runtime tests and a real start/status/restart/stop smoke cover the implemented lifecycle.
- [x] 4.3 Wire Herdr plugin actions and build output to the Fleet controller while retaining Collie's own CLI and Tailscale implementation as upstream code; verify start/status/restart/stop use only the private Fleet config and create no operating-system service or Tailscale mapping.
- [x] 4.4 Update the root TypeScript/build inputs so `fleet/` is typechecked and packaged without adding a runtime dependency, and verify root/web typechecks plus an atomic production build leave the stock Collie PWA intact.
- [x] 4.5 Update `FORK.toml` and `CHANGELOG.md`, run focused lifecycle/build tests, commit this stage separately, fetch/verify `origin/v3-dev`, and push a normal buildable commit.

## 5. Close the browser and public-source security boundary

- [ ] 5.1 Inspect the Collie v1.2.0 service-worker navigation order, make only the minimum invasive change if the authenticated document boundary is not already guaranteed, and verify one focused test proves an expired/logged-out navigation cannot be satisfied by an app-shell or API cache.
- [ ] 5.2 Add concise public documentation for the generic private `fleet.toml` schema, lead-only first-stage role, external HTTPS proxy contract, retained-but-inactive Tailscale path, and secret/logging boundary without committing a complete live configuration or deployment-specific value.
- [ ] 5.3 Audit every public route and API classification, cookie attribute, Origin/Host/return path, forwarded/trusted header, redirect, cache rule, listener bind, error body, log line, and runtime file permission against the specs; add only missing focused regression cases.
- [ ] 5.4 Run the fork checker and tracked-tree privacy scan, verify no v2 multi-host/iframe/SSH/ttyd/Discord module or private deployment term entered the tree, and reconcile proposal/design/specs/tasks with the implementation.
- [ ] 5.5 Run all root and web tests, both typechecks, lint, version checks, production build, strict OpenSpec validation, and the exact staged diff review; resolve failures without weakening an existing upstream gate.
- [ ] 5.6 Update `FORK.toml` and `CHANGELOG.md`, commit the security/documentation candidate separately, fetch/verify `origin/v3-dev`, push normally, and verify the remote exact candidate commit is independently buildable.

## 6. Validate the isolated staging deployment

- [ ] 6.1 From private operator guidance, deploy only the exact pushed candidate to separate loopback ports and a separate HTTPS staging origin, recording concrete configuration solely in ignored `LOCAL.md`; verify the previous service, plugin, Herdr process, and panes remain unchanged.
- [ ] 6.2 Verify through the public HTTPS origin that correct login succeeds; wrong/oversized/cross-origin attempts are generic and bounded; cookie flags, expiry, restart persistence, logout revocation, copied-token refusal, and safe returns satisfy the authentication spec.
- [ ] 6.3 Probe every public API family plus representative unknown/encoded paths without a session and verify no request reaches Collie; verify authenticated reads/writes work through the stock Collie UI and the session credential never reaches the upstream.
- [ ] 6.4 Verify Host/Origin/forwarded-header/redirect/cache/service-worker negatives, security headers, TLS behavior, Caddy header replacement, loopback-only listeners, and the absence of a public raw Collie or Gateway port.
- [ ] 6.5 Exercise removal and exact-commit redeployment of only the staging generation as rollback evidence, then present the candidate commit, source links, security results, known residual risks, and unchanged-service evidence for owner acceptance.

## 7. Reconcile and archive the source change

- [ ] 7.1 After owner acceptance, re-read every artifact and implementation path, complete any reality-driven artifact correction, and strictly validate the change with all tasks and verification evidence complete.
- [ ] 7.2 Sync the three delta specs into canonical source specs, verify their capability boundaries and public-safe content, and archive `reapply-authenticated-solo-gateway` through the generated workflow.
- [ ] 7.3 Commit only the sync/archive paths in a separate OpenSpec commit, fetch/verify `origin/v3-dev`, push normally, and report all planning, implementation, candidate, archive, and deployment commit identities separately.
