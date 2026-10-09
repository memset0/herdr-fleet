## Context

See proposal.md, "Why". The ground was read before anything changed:

```
baseline  v1.18.0  tag 990260b8…  commit 2ab62eaa…   (FORK.toml [upstream]; = merge-base main v1.19.0)
target    v1.19.0  tag 35d8c000…  commit 632a2bf7…   72 commits (v1.18.1 included), 228 files
preflight (bun scripts/check-fork.ts --target v1.19.0, before this change existed, no active change):
          13 of 26 invasive entries disturbed; 13 untouched; no owned path occupied
boundary  bun run test:fork: 21 pass; 910 owned and 69 invasive paths
```

What `v1.19.0` requires of an operator, read from the changelog and the source:

- **Configuration.** New `[phone]` switches in Collie's own launcher file (`adds`, `free_text`, `run`),
  each with an upstream default; Fleet owns none of them and resets none of them.
- **State.** Collie adds its own files for phone-added launchers and one-off run history beside its
  other state; nothing is renamed.
- **Runtime.** `MIN_BUN` unchanged; no `engines` change; no dependency or lockfile change. Crew
  protocol unchanged (the new routes ride the existing forward table).

**Answer: no operator configuration changes**, so the axis is MINOR.

## Goals / Non-Goals

**Goals:** `v1.19.0` as real ancestry, every port reviewed; the Host row's New workspace action on
upstream's New page with no invasive path; the new routes proven through the Gateway and the crew
link; the invasive count not grown.

**Non-Goals:** as in proposal.md.

## Decisions

### 1. The Host action navigates to `/new?machine=<host>`; the form port is dropped

Upstream deleted `new-space-sheet.tsx` and folded space creation into the `/new` route. Its address
already carries the machine (`newPath({ machine })` in `web/src/lib/nav.ts`, `?machine=`), and the
page's machine select initialises from it (`defaultHost`, which keeps the asked machine while it
accepts writes). So the fork's action becomes one navigation from the fork-owned
`web/src/components/fleet-row-actions.tsx`, through upstream's own `useNav().down(newPath(...))`. The
Host's existing gates (read-only, host write block, missing target, create-space capability) still
decide whether the action is offered. No session (`s`) is put in the address, so the page addresses
the Host's primary session, as the form did.

Alternatives: keep a fork copy of the deleted sheet (a fork-owned file reimplementing upstream UI the
release just retired — rejected, it duplicates the folder reads and create flow); patch `/new` to lock
its machine (a new invasive path for a guarantee the page's visible select already gives — rejected).

Accepted differences, recorded: the page has no workspace-name field, as upstream removed it for every
caller; the page's select remains changeable; if the Host stops accepting writes between the click
and the page's first render, upstream's `defaultHost` picks the first writable machine and the select
shows it.

### 2. The new routes through the Gateway and the crew link

The Gateway proxies every `/api/*` path with its own bearer and refuses only `/api/pair` and writes
under `/api/devices`. Every 1.19 route — `GET /api/launchers` (items, availability, recent runs),
`POST /api/launch` (by id with a request id, and a one-off line), `POST /api/launch/check`,
`/api/launchers/added{,/remove,/rename}`, `/api/launch/recent/{remove,clear}`, `/api/worktree{,/plan}`
— is therefore forwarded as is; a member is reached through the lead's crew forward, never the
Gateway. Upstream refuses the crew-only `/api/launchers/added/forget-device` on its browser path.

Per-device meaning under one shared device:

- Phone-added launcher rows are attributed to the adding device's label; behind the Gateway every
  browser is `fleet-gateway`, so every operator the Gateway admits shares one set of added rows.
- "Revoking a device removes the rows it added" (ADR 0094) is driven by a label disappearing from the
  registry while Collie runs. The supervisor revokes and re-enrols `fleet-gateway` only while no Collie
  child is running (before start, after stop), so the label never disappears under a running Collie and
  no Fleet restart removes added rows. The Gateway's refusal of device revocation keeps it so.
- The Again choice, the Agent/Command memory, the no-prompts confirm and the key board are
  browser-local, per browser, unchanged by the shared device.
- One-off command runs are on by default for any paired device. Behind the Gateway that is every
  operator the Gateway admits — who already has terminal access through the Pane — so nothing new is
  exposed; upstream's default is left as is and documented in `fleet/README.md`.

### 3. Overlaps

- Keys dock (ADR 0092): upstream's pad editor and default pad are adopted unchanged; the dock header no
  longer carries the host chip, upstream's choice. The fork's record control beside Send and the
  composer's other ports are kept.
- `crew-focus-audit-name-port`: upstream's forward table changed but still names the forwarded focus
  `focus`; kept.

### 4. Entry review

Every entry is reviewed against `v1.19.0`; the table is filled during apply.

## Risks / Trade-offs

- A member still on 3.14.0 answers the New page as an older Collie (agents by id unavailable); levelling
  every member removes it.
- Added launcher rows are shared across every operator the Gateway admits (single-operator deployments
  today).
