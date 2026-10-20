## Context

`codex.json` names `submit: ["Tab"]`, `enterWhileRunning: "steers"` and `queueKey: "Tab"`. `commitKeys` presses the queue key on the in-turn path (S0 read a turn, or the rows above moved while typing) for any harness whose Enter does not queue, and the submit keys otherwise. A Codex receipt says `queued` only from the queued-row witness (`labelFromWitness`).

## Decisions

- **Override at load, in an owned module.** `fleet/enter-steers.ts` lists the profiles (Codex) and rewrites their submit key to Enter in `loadProfiles`, so the bridge and the phone read the same profile and `codex.json` stays upstream's. Editing the JSON was rejected: an upstream re-tune of that file would conflict on every sync.
- **In-turn rule by shape, not by name.** `commitKeys` presses the submit keys when they contain Enter and Enter steers (`steersWithEnter`), for a text only. Commands keep the queue key (`commandWhileRunning: "queues"` was measured with Tab). Pi and OMP are untouched: their submit key is not Enter.
- **Label unchanged.** A steered text leaves no queued row, so the witness rule labels it `sent`; a text Codex did queue still shows its row and reads `queued`.
- **Tests:** the upstream Codex cases run on Collie's Tab profile through an edit (`upstreamCodexTab`), unchanged; K8 (an Enter-submit steering profile routed to the queue key) is the one upstream case this decision reverses, restated to Enter. Fleet's cases cover the loaded profile, an idle box, a running turn, a streaming answer and a command in a turn.
