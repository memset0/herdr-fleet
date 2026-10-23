## 1. Implementation

- [x] 1.1 In `bridge/server.ts` `lookNow`, await `crewLead?.sweep()` after `pokeNow()`; verify with a focused bridge test that a refresh on a lead with a crew lead calls `sweep` once and a solo refresh does not
- [x] 1.2 Declare the port in `FORK.toml` (reviewed = "v1.23.3") with its reason and verify list; verify with `bun scripts/check-fork.ts`
- [x] 1.3 In `native-navigation-shell.tsx` `markAllSeen`, call `refreshNow()` between the seen reads and `revalidate()`; verify with a shell or helper test that the order is reads → refresh → revalidate

## 2. Verification

- [x] 2.1 Add the CHANGELOG line; run both typechecks, `bun run lint` and the focused tests
- [ ] 2.2 On the lead after deploy, mark a peer pane seen with Mark all seen and confirm it clears without waiting for a sweep
