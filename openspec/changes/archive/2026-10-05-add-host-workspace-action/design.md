## Context

See proposal.md. Host navigation rows have no action subject. Native creation already supports an explicit host/session scope; the existing new-space form normally chooses a writable Host and allows switching it.

## Goals / Non-Goals

Goals: expose creation from a Host without copying the form or introducing an API. Non-goals: changing ambient creation defaults, workspace/Host renaming or other action routing.

## Decisions

- Add a Host subject carrying its registry id and label, including empty Hosts; render its action using the existing owned row-actions surface selection helpers.
- Store the selected target while the form is open. Normalize the lead to an absent host and use an explicit primary-session scope, never the current route's session. Read the selected Host's write and mux capability gates again before submitting.
- Add an optional fixedHost port to upstream-owned new-space-sheet.tsx. It fixes selection, hides the Host picker and skips writable-Host fallback, while omitted callers retain upstream behavior. This narrow port is smaller than cloning the form into an owned module. Declare the path and its port tests in FORK.toml; no other invasive paths are needed.
- Reuse existing localized New space wording and label/directory inputs. The product already calls workspaces Spaces in this UI.

## Risks / Trade-offs

- A peer outage could trigger the form's ordinary fallback → fixedHost bypasses fallback and live health blocks submit.
- A form may retain ambient scope accidentally → tests create from a different ambient Host/session and assert selected primary scope, including explicit empty lead scope.

## Migration Plan

Frontend-only patch on the lead, no data migration or peer redeployment. Archive after focused checks; deploy the published patch through the existing controller.

## Verification

86 focused navigation/menu/form tests passed, alongside both typechecks, scoped lint and fork/public-tree checks. Browser review opened a Host pointer menu and its fixed-target form, cancelled with zero mutation requests, and verified both rails hidden at 1279px and shown at 1280/1366/1536px. No live workspace was created by verification and no full test suite was run.
