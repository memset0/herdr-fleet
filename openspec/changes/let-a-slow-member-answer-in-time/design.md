## Context

`packTimeoutBudget` returns `min(wanted, poll × 0.8)`, with `wanted` from `COLLIE_PACK_TIMEOUT_MS`
and a 1200 ms default, and the poll from `COLLIE_POLL_MS` with a 1500 ms default. Both are read from
the environment. `collieChildEnv` copies the whole inherited environment and deletes only the keys
Fleet must own, so neither variable is blocked — there is simply no supported place to set them for a
plugin the Herdr runtime launches, which has no per-plugin environment.

## Goals / Non-Goals

**Goals:** the lead's pack timing is part of its private configuration; the rail stops reporting a
member it has never heard from as a refusal; slow and refused are told apart.

**Non-Goals:** upstream's arithmetic, the clamp, and anything about what admits a member.

## Decisions

### 1. A typed section, not a file of environment variables

The obvious shortcut is to source an env file beside the configuration. It is rejected: the whole
point of `collieChildEnv` deleting the keys it owns is that the environment is not a configuration
surface, and re-opening it as one would let a stray variable decide the port the Gateway proxies to.
Two named, validated fields cost a few lines and cannot do that.

### 2. The clamp stays, and the poll interval moves with the budget

A budget above the poll interval means a peer can still be answering when the next sweep starts, and
upstream's ceiling exists to make that impossible. Wanting a 2400 ms budget therefore means asking
for a 3000 ms poll, and the configuration says both rather than hiding one behind the other. The rail
refreshing every 3 s instead of 1.5 s is the price, and it is smaller than a member that vanishes.

### 3. A zero receipt is a distinct state, not an old one

`data.ts - 0` is thirty years, so a member never heard from cleared every threshold instantly. The
fix is not a larger threshold: it is that "never heard from" is its own case. A member the lead has
not yet reached is not refusing — it is still arriving — and the rail says so until a real receipt
exists to age.

## Risks / Trade-offs

- **[A 3 s poll feels slower]** → it is, everywhere, and it is the only way to buy a budget above
  1200 ms without editing upstream's clamp. Measured first, kept only if the receipts improve.
- **[An operator sets a budget the clamp will bite]** → upstream already prints the arithmetic when it
  bites; the configuration records what was asked, and the clamp records what was granted.

## Migration Plan

1. Add the section and the two environment values, with tests.
2. Fix the rail's two states, with tests.
3. Cut the release, deploy to the lead, re-measure, and roll back by removing the section.
