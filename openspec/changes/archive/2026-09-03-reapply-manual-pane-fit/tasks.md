## 1. Reconcile the resize boundary

- [x] 1.1 Re-read exact Collie v1.2.0 Display Settings, AgentChat scrollport, capability, Pane model, Herdr adapter, server write/audit/session/shutdown paths, the v2 manual-resize requirement, `FORK.toml`, and this change; record the clean baseline and task-owned paths.
- [x] 1.2 Confirm the exact Herdr controller command/protocol and v2 no-takeover implementation against current Herdr 0.8.2 behavior; verify the owned design can retain/reuse/release a controller without changing Herdr source.

## 2. Implement owned geometry and controller behavior

- [x] 2.1 Add pure manual-fit geometry calculation under `fleet/ui/` with 20..500 clamping; verify focused tests cover padding, floor, bounds, missing/zero/non-finite metrics, and no implicit invocation.
- [x] 2.2 Add closed resize input/result validation under `fleet/manual-pane-fit/`; verify integer/range/unknown-field and safe error mapping tests.
- [x] 2.3 Add the trusted socket+Pane controller lease manager without takeover; verify acquisition, exact command, serialization, reuse, conflict, child exit, failure cleanup, and dispose-all tests.
- [x] 2.4 Add the owned server action that obtains trusted viewport rows/socket/Pane scope, preserves rows, invokes the manager, and returns audit-safe results; verify missing rows/unsupported/conflict/success tests.

## 3. Add minimal Collie backend ports

- [x] 3.1 Add total `resizePane` capability fields and route evidence; verify only Herdr advertises support and all other/older adapters fail closed.
- [x] 3.2 Retain optional viewport rows in the generic Pane model and Herdr adapter, plus a server-only state lookup; verify wire/state tests preserve existing bodies while exposing trusted positive rows.
- [x] 3.3 Add `resize` to the protected Pane route and dispatch through existing session/same-origin/write/Pane/audit boundaries; verify invalid body, read-only denial, unsupported mux, cross-session scope, success dimensions, and `pane.resize` audit.
- [x] 3.4 Wire controller disposal into Pane/session/server shutdown without process-name/port/pidfile cleanup; verify lifecycle tests release only owned leases.

## 4. Add the native manual-fit UI

- [x] 4.1 Add one optional Display Settings row slot immediately below Text size and verify the generic component remains unchanged when the slot is absent.
- [x] 4.2 Add the typed browser resize API and owned `Resize`/`Custom` row using the real scrollport/current font/session/capability/write state; verify one click sends one request, busy prevents duplicates, result uses existing status, and unsupported/read-only states hide or disable the action.
- [x] 4.3 Verify rerender, viewport/drawer/font/layout changes issue no request; add typed i18n strings to all dictionaries and focused accessibility/order tests.

## 5. Reconcile fork and validate

- [x] 5.1 Extend the existing `fleet-runtime` owned contracts/tests and add one exact invasive entry for all capability/model/adapter/state/server/API/Display/AgentChat/test/i18n ports; verify the fork checker rejects broader or stale anchors.
- [x] 5.2 Add concise public docs and Changelog, reconcile all artifacts, and verify no shortcut, auto-resize, non-Herdr, router, Gateway, Pack, SSH, notification, ttyd, or STT scope entered the candidate.
- [x] 5.3 Run focused owned/backend/UI/capability/server tests plus affected typecheck/lint/fork/version/OpenSpec checks during implementation.
- [x] 5.4 At commit readiness run the full root/Web suites once with Bun 1.3.14, both typechecks, full-tree lint, production build, fork/version/OpenSpec checks, privacy audit, and exact staged diff review.

## 6. Publish, stage, and archive

- [x] 6.1 Commit the feature as one reviewed conventional commit, fetch/verify `origin/v3-dev`, push normally, and verify the public exact candidate.
- [x] 6.2 Deploy only that exact commit to isolated v3 staging, preserve settings/STT/v2/Herdr, and present the manual action for owner browser acceptance.
- [x] 6.3 After acceptance, sync `fleet-manual-pane-fit`, archive the change, commit/push the archive separately, and include it in the final cumulative archive-HEAD staging deployment before reporting source/deployment identities.
