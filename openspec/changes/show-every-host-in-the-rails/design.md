## Context

`deriveNavigationTree` takes one `hostId`/`hostLabel` and returns `{ rows: [host] }` — a single Host
row over that machine's spaces. The shell feeds both rails from `ambientPanes(...)`, Collie's own
helper whose documented job is narrowing rows to the address the URL is on. Both choices were correct
while an install was one machine; together they are now the only reason a pack renders as a solo.

Everything needed already exists upstream: `lib/hosts.ts` has `isMultiHost`, `hostName`, `serverFor`
and `paneScope`, and `components/host-chip.tsx` renders a host marker that hides itself when the
snapshot lists one machine. Collie's own card already uses that chip.

## Goals / Non-Goals

**Goals:** every member visible in both rails; each Agent row marked with its host; a row opens on its
own member; a solo install unchanged.

**Non-Goals:** filtering or reordering controls, a host switcher, reachability presentation of the
rails' own, and any change to the snapshot, the Pack wire or Collie's own surfaces.

## Decisions

### 1. The model takes a list of hosts rather than one

`deriveNavigationTree` gains a hosts array; each entry keeps the `hostId`/`hostLabel` pair it already
had, plus that host's own spaces, tabs and panes. It emits one Host row per entry, each with the
collapse identity it already had, and the single-entry case produces exactly today's output.

Rejected: calling the existing single-host function once per host and concatenating. The selection
and the disclosure bookkeeping are computed across the whole tree, so N independent calls would each
believe they own the selection.

### 2. The shell stops narrowing the rails to the ambient host

`ambientPanes` still answers the question it was written for, and the route still uses it wherever a
single address is what is wanted. The rails ask a different question — what does this pack contain —
so they take the merged rows and group them by host.

Rejected: widening `ambientPanes` itself. It is Collie's own helper with Collie's own callers, and
its narrowing is exactly right for them.

### 3. Rows are opened with their own scope, which the shell already computes correctly

The open handlers already pass the row's own pane/agent to `paneScope`, so a row on another member
already resolves to that member's host and session. Feeding the rails more rows is therefore the
whole change on that path, not a new navigation rule.

### 4. Host order is the roster's, lead first

Order comes from the snapshot's server roster rather than from the rows, so it is stable while panes
come and go, and the machine the operator is reading from is first. A host present in the rows but
absent from the roster sorts after the roster's, by id, rather than being dropped.

### 5. The Agent row reuses Collie's own chip

`HostChip` already self-hides on a solo snapshot, which is exactly the requirement, and it is the
marker every other host-aware Collie surface uses. A fork-drawn badge would be a second vocabulary
for one fact.

## Risks / Trade-offs

- **[A solo install changes]** → the single-host case is pinned by focused tests that compare against
  today's rows, and the chip draws nothing without a roster.
- **[A long rail]** → the existing per-kind bounds still apply, and a Host item collapses on its own,
  which is what makes many members readable.
- **[A row opens on the wrong machine]** → the scope is computed from the row, and a focused test
  drives a row belonging to the non-ambient member.

## Migration Plan

1. Generalise the model to a hosts array, keeping the single-host output identical.
2. Feed both rails the merged rows grouped by host, and mark each Agent row with Collie's chip.
3. Update the focused tests for both rails, `FORK.toml` and `CHANGELOG.md`.
4. Roll back by redeploying the previous commit; nothing here is persisted.
