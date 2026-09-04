## 1. Generalise the hierarchy model

- [x] 1.1 Re-read the canonical `fleet-native-navigation-sidebars` requirements, the navigation model, both rails, the shell, and Collie's own host helpers and chip; verify clean `v3-dev` and record the task-owned paths.
- [x] 1.2 Take a hosts array in the navigation model and emit one collapsible Host row per entry over that host's own rows, ordered by the roster with the lead first and any roster-absent host after it by id; verify a focused test pins the single-host output unchanged and a two-host tree's shape and order.
- [x] 1.3 Verify per-host collapse conceals only its own member's rows and that the existing per-kind bounds still apply across hosts.

## 2. Feed both rails the whole pack

- [x] 2.1 Stop narrowing the rails to the ambient host in the shell, grouping the merged rows by host for the hierarchy and passing every member's Agents to the Agent rail, while leaving Collie's own helper and its other callers untouched.
- [x] 2.2 Mark each Agent row with Collie's own host chip so a solo snapshot draws nothing; verify focused tests cover both the multi-host and solo cases.
- [x] 2.3 Verify a row belonging to a member other than the current address opens on that member's own host and session.

## 3. Reconcile and publish

- [x] 3.1 Update `FORK.toml` contracts and verification for the widened rails, and add one `CHANGELOG.md` line.
- [x] 3.2 Run the focused model, tree, rail and shell tests plus both typechecks and lint over the changed files.
- [x] 3.3 At commit readiness run the full root and Web suites once with pinned Bun 1.3.14, the production build, version, fork, strict OpenSpec validation and a privacy audit; commit only this change's paths, push, deploy the exact candidate, then sync, archive, push and redeploy the archive HEAD.
