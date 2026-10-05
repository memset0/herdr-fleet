## Source acceptance

- Strict change validation and fork-boundary check pass; no upstream or crew-wire path is changed.
- Both typechecks, full-tree lint and the ordinary root build pass.
- Focused configuration/lifecycle/control cases pass, including a real disposable daemon without an available external projection or an SSH executable. Existing SSH command and status tests retain their exact assertions.
- Full backend groups pass: 3,927 bridge cases, 1,622 CLI cases, 229 script cases and 652 Fleet cases. Both launcher/compiled-CLI shell suites and all remaining packaging/guard shell checks pass.
- Full frontend: 324 files pass; 13,947 cases pass, with 32 expected failures and 47 existing todo cases.
- A privileged host's permission bypass and installed-tool fallback violate assumptions in two unchanged upstream fixtures. Those cases pass in process-scoped permission/mount isolation. The compiled CLI's ownership scenarios pass in a nonzero-UID user namespace with an isolated tool fallback; no actual system binary, source permission or upstream test is changed. A constrained runner uses a 15-second per-case budget for the backend file-I/O fixture.

## Publication assessment

The freshest observed stable tag is 3.8.2. External lifecycle code runs on peers, so this change warrants minor 3.9.0, with every existing member receiving it lead first. Existing SSH configurations remain valid. The generic operator documentation and functional changelog line have been merged into the latest clean shared files after the concurrent author completed its release. Live deployment acceptance remains outside this source change.
