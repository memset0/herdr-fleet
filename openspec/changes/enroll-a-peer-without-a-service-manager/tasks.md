## 1. Add the owned enrolment module

- [x] 1.1 Re-read the canonical `fleet-pack-authority` and `fleet-pack-reachability` specs, `PACK_PROTOCOL.md` §8.2 and §8.3, `bridge/pack/enrollment.ts`, and `FORK.toml`; verify clean `v3-dev` equals `origin/v3-dev` and record the exact task-owned paths.
- [ ] 1.2 Add one owned module that mints an invite on a lead and completes the exchange on a peer using only Collie's exported transitions, its trust-store update seam, its identity minter and its request/response parsers; verify focused tests cover a first mint that creates the store, a repeat mint that keeps it, and an acceptance that pins the lead.
- [ ] 1.3 Put the exchange behind an injectable transport seam so focused tests drive success, a refused invite, an unreachable lead and a malformed response without a network or a generated key; verify no secret appears in any diagnostic.
- [ ] 1.4 Verify the module calls no `cli/**` symbol, resolves no plugin identity, probes no service manager, and starts, stops or restarts no process.

## 2. Add the two explicit operator commands

- [ ] 2.1 Add `pack-invite` to the existing entrypoint: mint, print the token exactly once, print its expiry, and print the plugin restart that makes the running lead serve it; verify a focused test pins that the token reaches standard output and nothing else.
- [ ] 2.2 Add `pack-join` reading the token from standard input or an owner-only file, refusing a literal argument with a message naming both accepted forms; verify focused tests cover both accepted forms and the refusal.
- [ ] 2.3 Verify both commands refuse a role they do not belong to and leave the trust store byte-for-byte unchanged when they refuse.

## 3. Reconcile the fork and source artifacts

- [ ] 3.1 Extend the existing `fleet-runtime` contracts and verification list in `FORK.toml` for the new owned module without a redundant owned block or an invasive path.
- [ ] 3.2 Add one `CHANGELOG.md` line and document both commands publicly, including why Collie's own membership verbs must not be run against a Fleet deployment; verify the documentation carries no deployment fact.
- [ ] 3.3 Run focused enrolment, authority, configuration and entrypoint tests plus affected typecheck, lint, fork and OpenSpec checks during implementation.

## 4. Validate, publish, and archive

- [ ] 4.1 At commit readiness run the full root suite and the full Web suite once with pinned Bun 1.3.14, both typechecks, lint over the changed files, production build, version and fork checks, strict OpenSpec validation, a privacy audit and an exact staged-diff review.
- [ ] 4.2 Commit the complete feature with the required trailers, fetch and verify the remote, push, and verify the exact commit.
- [ ] 4.3 Deploy the exact pushed candidate to existing staging, verify the lead's behaviour is unchanged and that no membership exists, then sync, archive, push the archive separately, and redeploy the archive HEAD.
