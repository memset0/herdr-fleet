## Context

`KeyGate.mint` stamps a token with `expiresAt = now + TOKEN_LIFETIME_MS` (150 ms) and `commit` refuses it with `stale_token` once that passes. In `SendProtocol.commit` the token is minted before `store.markSubmitSent`, a synchronous write of the request record (exists, read, write, chmod, rename). On a state directory on a network filesystem those five round trips measured a median of about 180 ms and spikes past 250 ms, so a verified send ended `typed_not_submitted(stale_token)` with the text left in the box. The same lifetime bounds an ask answer's token, which is minted and committed with nothing between.

## Decisions

- **Lifetime: 3 s, a fork-owned constant.** `fleet/send-patience.ts` gains `KEY_TOKEN_LIFETIME_MS`; `key-gate.ts` takes `TOKEN_LIFETIME_MS` from it, one imported name. Twenty times upstream's, well beyond the measured write time with room for a loaded filesystem, and still far inside the S1 and S2 bounds.
- **Not reordered.** Minting after the record write would let the time between S1's verdict and the key grow without any bound; keeping the order and a longer lifetime keeps a bound and keeps upstream's code shape, so the change is one constant.
- **Revision check unchanged.** It is what refuses a person's key or a protocol write between S1 and the commit (`stale_surface`); lifetime never guarded that.
- **Tests:** the protocol case that aged the token by a literal 151 ms is restated as `TOKEN_LIFETIME_MS + 1`, same intent; the gate's own tests already use the exported constant. A send-patience case holds the new lifetime above upstream's and inside the S1 bound.
